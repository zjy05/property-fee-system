/**
 * 一次性迁移：SQLite 物业库 → 独立 MySQL 8。
 *
 * 运行方式（在应用容器里）：
 *   DB_DRIVER=mysql MYSQL_HOST=... node server/migrate-sqlite-to-mysql.js
 *
 * 默认目标库必须为空；如果目标已有数据（例如应用先启动过），
 * 需要显式 MIGRATE_FORCE=1 才会清空后重迁。
 * 迁移前请先备份 data/app.db，迁移后核对各表条数。
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { db, initDb, dbInfo, DATA_DIR } from './db.js';

const SQLITE_PATH = process.env.SQLITE_PATH || path.join(DATA_DIR, 'app.db');
const FORCE = process.env.MIGRATE_FORCE === '1';
const TABLES = ['users', 'owners', 'readings', 'communities', 'settings', 'login_logs'];

if (db.dialect !== 'mysql') {
  console.error('[migrate] 必须设置 DB_DRIVER=mysql 才能执行此脚本');
  process.exit(1);
}
if (!fs.existsSync(SQLITE_PATH)) {
  console.error(`[migrate] 找不到 SQLite 文件：${SQLITE_PATH}`);
  process.exit(1);
}

await initDb();
console.log(`[migrate] 目标：${JSON.stringify(dbInfo())}`);
console.log(`[migrate] 源：${SQLITE_PATH}`);

const source = new DatabaseSync(SQLITE_PATH);

function sourceTableExists(table) {
  return Boolean(source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
}

function sourceColumns(table) {
  return source.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function sourceCount(table) {
  if (!sourceTableExists(table)) return 0;
  return Number(source.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c);
}

function q(table) {
  return '`' + table + '`';
}

// 目标表为空时直接迁；已有数据必须显式 --force
let targetHasData = false;
const targetCountsBefore = {};
for (const table of TABLES) {
  const row = await db.get(`SELECT COUNT(*) AS c FROM ${q(table)}`);
  const count = Number(row.c);
  targetCountsBefore[table] = count;
  if (count > 0) targetHasData = true;
}
if (targetHasData && !FORCE) {
  console.error('[migrate] 目标 MySQL 已有数据，已停止。确认要覆盖后设置 MIGRATE_FORCE=1 再运行。');
  console.error('[migrate] 当前条数：', targetCountsBefore);
  await db.close();
  process.exit(2);
}
if (targetHasData && FORCE) {
  console.log('[migrate] MIGRATE_FORCE=1：清空目标表后重迁');
  await db.transaction(async (tx) => {
    for (const table of [...TABLES].reverse()) await tx.run(`DELETE FROM ${q(table)}`);
  });
}

const NUMERIC = new Set([
  'propertyFee', 'waterPrev', 'waterCurr', 'electricPrev', 'electricCurr', 'waterUsage', 'electricUsage',
  'yearElectricUsage', 'waterAmount', 'electricAmount', 'lineAmount', 'garbageFee', 'totalAmount',
  'waterLoss', 'electricLoss', 'customPrev', 'customCurr', 'customUsage', 'customLoss', 'customPrice',
  'customAmount', 'item1Amount', 'item2Amount', 'item3Amount', 'lastBalance', 'curBalance', 'paidAmount',
  'waterPrice', 'hasTier', 'electricPrice', 'lineFee', 'waterLossRate', 'electricLossRate', 'paid', 'success',
]);

function valueFor(table, col, row) {
  if (table === 'settings') {
    if (col === 'setting_key') return row.setting_key ?? row.key ?? '';
    if (col === 'setting_value') return row.setting_value ?? row.value ?? '';
  }
  if (col === 'permissions') return row.permissions ?? '[]';
  if (col === 'buildings') {
    const v = row.buildings ?? '[]';
    return typeof v === 'string' ? v : JSON.stringify(v);
  }
  const v = row[col];
  if (v === null || v === undefined) {
    if (NUMERIC.has(col)) return 0;
    return '';
  }
  if (col === 'paid' || col === 'success' || col === 'hasTier') return Number(v) ? 1 : 0;
  return v;
}

async function copyTable(table) {
  if (!sourceTableExists(table)) {
    console.log(`[migrate] 源没有 ${table} 表，跳过`);
    return { table, source: 0, target: 0 };
  }
  const rows = source.prepare(`SELECT * FROM ${table}`).all();
  const destCols = (await db.all(`SHOW COLUMNS FROM ${q(table)}`)).map((c) => c.Field);
  const cols = table === 'settings'
    ? ['setting_key', 'setting_value']
    : destCols;
  const colSql = cols.map((c) => '`' + c + '`').join(',');
  const marks = cols.map(() => '?').join(',');
  const sql = `INSERT INTO ${q(table)} (${colSql}) VALUES (${marks})`;

  if (rows.length > 0) {
    await db.transaction(async (tx) => {
      for (const row of rows) {
        await tx.run(sql, cols.map((col) => valueFor(table, col, row)));
      }
    });
  }
  return { table, source: rows.length, target: Number((await db.get(`SELECT COUNT(*) AS c FROM ${q(table)}`)).c) };
}

const results = [];
for (const table of TABLES) results.push(await copyTable(table));

console.log('\n[migrate] 迁移结果：');
let failed = false;
for (const r of results) {
  const ok = r.source === r.target;
  if (!ok) failed = true;
  console.log(`  ${ok ? 'OK ' : 'BAD'} ${r.table.padEnd(12)} 源 ${r.source} / 目标 ${r.target}`);
}

// 关键金额/数据抽样校验
if (!failed && sourceTableExists('owners') && sourceTableExists('readings')) {
  const owner = source.prepare('SELECT * FROM owners ORDER BY id LIMIT 1').get();
  if (owner) {
    const dest = await db.get('SELECT * FROM owners WHERE id=?', [owner.id]);
    if (!dest || dest.name !== owner.name || dest.roomNo !== owner.roomNo) {
      failed = true;
      console.error('[migrate] 业主抽样校验失败');
    }
  }
  const reading = source.prepare('SELECT * FROM readings ORDER BY id LIMIT 1').get();
  if (reading) {
    const dest = await db.get('SELECT * FROM readings WHERE id=?', [reading.id]);
    if (!dest || Number(dest.totalAmount) !== Number(reading.totalAmount)) {
      failed = true;
      console.error('[migrate] 抄表抽样校验失败');
    }
  }
}

await db.close();
source.close();

if (failed) {
  console.error('[migrate] 有表条数或抽样不一致，请先不要切换应用，检查上面的 BAD 行。');
  process.exit(3);
}
console.log('\n[migrate] 全部表条数一致，可以切换应用。');
