import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * 数据库适配层：
 * - 默认 SQLite（桌面版 / 未设置 DB_DRIVER 时），保持原来的单文件部署；
 * - DB_DRIVER=mysql 时连独立 MySQL 8（Docker 生产部署）。
 *
 * 两种驱动统一成 async 接口，业务代码只认 db.run/all/get/exec/transaction，
 * 迁移期间可以随时通过环境变量切回 SQLite 回滚。
 */
export const DRIVER = String(process.env.DB_DRIVER || 'sqlite').toLowerCase() === 'mysql' ? 'mysql' : 'sqlite';
export const IS_MYSQL = DRIVER === 'mysql';

const APP_ROOT = process.env.APP_ROOT || process.cwd();
export const DATA_DIR = process.env.DATA_DIR || path.join(APP_ROOT, 'data');
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'app.db');

const MYSQL = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'property',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'property_fee',
};

let sqlite = null;
let pool = null;

function sqliteExecutor(conn) {
  return {
    async run(sql, params = []) {
      const r = conn.prepare(sql).run(...params);
      return { changes: Number(r.changes || 0), lastInsertRowid: r.lastInsertRowid };
    },
    async all(sql, params = []) {
      return conn.prepare(sql).all(...params);
    },
    async get(sql, params = []) {
      return conn.prepare(sql).get(...params);
    },
    async exec(sql) {
      conn.exec(sql);
    },
  };
}

function mysqlExecutor(conn) {
  return {
    async run(sql, params = []) {
      const [result] = await conn.query(sql, params);
      return result;
    },
    async all(sql, params = []) {
      const [rows] = await conn.query(sql, params);
      return rows;
    },
    async get(sql, params = []) {
      const [rows] = await conn.query(sql, params);
      return rows[0];
    },
    async exec(sql) {
      await conn.query(sql);
    },
  };
}

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  community_id TEXT DEFAULT '',
  permissions TEXT DEFAULT '[]',
  created_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  roomNo TEXT DEFAULT '',
  communityId TEXT DEFAULT '',
  building TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  room TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  waterMeterNo TEXT DEFAULT '',
  electricMeterNo TEXT DEFAULT '',
  propertyFee REAL DEFAULT 0,
  createdAt TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS readings (
  id TEXT PRIMARY KEY,
  ownerId TEXT NOT NULL,
  period TEXT DEFAULT '',
  receiptNo TEXT DEFAULT '',
  waterPrev REAL DEFAULT 0,
  waterCurr REAL DEFAULT 0,
  electricPrev REAL DEFAULT 0,
  electricCurr REAL DEFAULT 0,
  waterUsage REAL DEFAULT 0,
  electricUsage REAL DEFAULT 0,
  yearElectricUsage REAL DEFAULT 0,
  electricTier TEXT DEFAULT '',
  waterAmount REAL DEFAULT 0,
  electricAmount REAL DEFAULT 0,
  lineAmount REAL DEFAULT 0,
  propertyFee REAL DEFAULT 0,
  garbageFee REAL DEFAULT 0,
  totalAmount REAL DEFAULT 0,
  paid INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS communities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  buildings TEXT DEFAULT '[]',
  waterPrice REAL DEFAULT 0,
  garbageFee REAL DEFAULT 0,
  hasTier INTEGER DEFAULT 1,
  electricPrice REAL DEFAULT 0,
  lineFee REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_logs (
  id TEXT PRIMARY KEY,
  username TEXT DEFAULT '',
  success INTEGER DEFAULT 0,
  ip TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_readings_owner ON readings(ownerId);
CREATE INDEX IF NOT EXISTS idx_readings_period ON readings(period);
`;

const MYSQL_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(128) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    community_id VARCHAR(64) DEFAULT '',
    permissions LONGTEXT,
    created_at VARCHAR(40) DEFAULT ''
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS owners (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    roomNo VARCHAR(255) DEFAULT '',
    communityId VARCHAR(64) DEFAULT '',
    building VARCHAR(100) DEFAULT '',
    unit VARCHAR(100) DEFAULT '',
    room VARCHAR(100) DEFAULT '',
    phone VARCHAR(50) DEFAULT '',
    waterMeterNo VARCHAR(100) DEFAULT '',
    electricMeterNo VARCHAR(100) DEFAULT '',
    propertyFee DOUBLE DEFAULT 0,
    createdAt VARCHAR(40) DEFAULT '',
    KEY idx_owners_community (communityId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS readings (
    id VARCHAR(64) PRIMARY KEY,
    ownerId VARCHAR(64) NOT NULL,
    period VARCHAR(20) DEFAULT '',
    receiptNo VARCHAR(64) DEFAULT '',
    waterPrev DOUBLE DEFAULT 0,
    waterCurr DOUBLE DEFAULT 0,
    electricPrev DOUBLE DEFAULT 0,
    electricCurr DOUBLE DEFAULT 0,
    waterUsage DOUBLE DEFAULT 0,
    electricUsage DOUBLE DEFAULT 0,
    yearElectricUsage DOUBLE DEFAULT 0,
    electricTier VARCHAR(100) DEFAULT '',
    waterAmount DOUBLE DEFAULT 0,
    electricAmount DOUBLE DEFAULT 0,
    lineAmount DOUBLE DEFAULT 0,
    propertyFee DOUBLE DEFAULT 0,
    garbageFee DOUBLE DEFAULT 0,
    totalAmount DOUBLE DEFAULT 0,
    paid TINYINT(1) DEFAULT 0,
    createdAt VARCHAR(40) DEFAULT '',
    waterLoss DOUBLE DEFAULT 0,
    electricLoss DOUBLE DEFAULT 0,
    customName VARCHAR(100) DEFAULT '',
    customPrev DOUBLE DEFAULT 0,
    customCurr DOUBLE DEFAULT 0,
    customUsage DOUBLE DEFAULT 0,
    customLoss DOUBLE DEFAULT 0,
    customPrice DOUBLE DEFAULT 0,
    customAmount DOUBLE DEFAULT 0,
    item1Name VARCHAR(100) DEFAULT '',
    item1Amount DOUBLE DEFAULT 0,
    item1Note VARCHAR(255) DEFAULT '',
    item2Name VARCHAR(100) DEFAULT '',
    item2Amount DOUBLE DEFAULT 0,
    item2Note VARCHAR(255) DEFAULT '',
    item3Name VARCHAR(100) DEFAULT '',
    item3Amount DOUBLE DEFAULT 0,
    item3Note VARCHAR(255) DEFAULT '',
    lastBalance DOUBLE DEFAULT 0,
    curBalance DOUBLE DEFAULT 0,
    paidAmount DOUBLE DEFAULT 0,
    receiver VARCHAR(100) DEFAULT '',
    reader VARCHAR(100) DEFAULT '',
    note VARCHAR(500) DEFAULT '',
    KEY idx_readings_owner (ownerId),
    KEY idx_readings_period (period)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS communities (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    buildings LONGTEXT,
    waterPrice DOUBLE DEFAULT 0,
    garbageFee DOUBLE DEFAULT 0,
    hasTier TINYINT(1) DEFAULT 1,
    electricPrice DOUBLE DEFAULT 0,
    lineFee DOUBLE DEFAULT 0,
    waterLossRate DOUBLE DEFAULT 0,
    electricLossRate DOUBLE DEFAULT 0,
    customMeterName VARCHAR(100) DEFAULT '自定义'
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value LONGTEXT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS login_logs (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) DEFAULT '',
    success TINYINT(1) DEFAULT 0,
    ip VARCHAR(100) DEFAULT '',
    user_agent VARCHAR(500) DEFAULT '',
    created_at VARCHAR(40) DEFAULT '',
    KEY idx_login_logs_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

function sqliteTableColumns(table) {
  return sqlite.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function sqliteAddColumn(table, columns, col, def) {
  if (!columns.includes(col)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    console.log(`[migrate] ${table} 增加 ${col} 列`);
  }
}

function migrateSqliteColumns() {
  // v1.4+：settings 从 key/value 改成 setting_key/setting_value，避开 MySQL 保留字
  const settingsCols = sqliteTableColumns('settings');
  if (settingsCols.includes('key') && !settingsCols.includes('setting_key')) {
    sqlite.exec('ALTER TABLE settings RENAME COLUMN key TO setting_key');
    console.log('[migrate] settings.key -> setting_key');
  }
  if (settingsCols.includes('value') && !settingsCols.includes('setting_value')) {
    sqlite.exec('ALTER TABLE settings RENAME COLUMN value TO setting_value');
    console.log('[migrate] settings.value -> setting_value');
  }

  const readingsCols = sqliteTableColumns('readings');
  for (const [col, def] of [
    ['lineAmount', 'REAL DEFAULT 0'],
    ['waterLoss', 'REAL DEFAULT 0'],
    ['electricLoss', 'REAL DEFAULT 0'],
    ['customName', "TEXT DEFAULT ''"],
    ['customPrev', 'REAL DEFAULT 0'],
    ['customCurr', 'REAL DEFAULT 0'],
    ['customUsage', 'REAL DEFAULT 0'],
    ['customLoss', 'REAL DEFAULT 0'],
    ['customPrice', 'REAL DEFAULT 0'],
    ['customAmount', 'REAL DEFAULT 0'],
    ['item1Name', "TEXT DEFAULT ''"],
    ['item1Amount', 'REAL DEFAULT 0'],
    ['item1Note', "TEXT DEFAULT ''"],
    ['item2Name', "TEXT DEFAULT ''"],
    ['item2Amount', 'REAL DEFAULT 0'],
    ['item2Note', "TEXT DEFAULT ''"],
    ['item3Name', "TEXT DEFAULT ''"],
    ['item3Amount', 'REAL DEFAULT 0'],
    ['item3Note', "TEXT DEFAULT ''"],
    ['lastBalance', 'REAL DEFAULT 0'],
    ['curBalance', 'REAL DEFAULT 0'],
    ['paidAmount', 'REAL DEFAULT 0'],
    ['receiver', "TEXT DEFAULT ''"],
    ['reader', "TEXT DEFAULT ''"],
    ['note', "TEXT DEFAULT ''"],
  ]) sqliteAddColumn('readings', readingsCols, col, def);

  const commCols = sqliteTableColumns('communities');
  for (const [col, def] of [
    ['hasTier', 'INTEGER DEFAULT 1'],
    ['electricPrice', 'REAL DEFAULT 0'],
    ['lineFee', 'REAL DEFAULT 0'],
    ['waterLossRate', 'REAL DEFAULT 0'],
    ['electricLossRate', 'REAL DEFAULT 0'],
    ['customMeterName', "TEXT DEFAULT '自定义'"],
  ]) sqliteAddColumn('communities', commCols, col, def);

  const ownerCols = sqliteTableColumns('owners');
  for (const [col, def] of [
    ['unit', "TEXT DEFAULT ''"],
    ['room', "TEXT DEFAULT ''"],
  ]) sqliteAddColumn('owners', ownerCols, col, def);

  const userCols = sqliteTableColumns('users');
  sqliteAddColumn('users', userCols, 'permissions', "TEXT DEFAULT '[]'");

  // 旧库只存整串 roomNo，补拆楼栋/单元/房号（只处理 unit/room 都为空的记录）
  const rows = sqlite
    .prepare("SELECT id,roomNo,building,unit,room FROM owners WHERE (unit IS NULL OR unit='') AND (room IS NULL OR room='')")
    .all();
  if (rows.length > 0) {
    const upd = sqlite.prepare('UPDATE owners SET building=?, unit=?, room=? WHERE id=?');
    sqlite.exec('BEGIN');
    try {
      for (const r of rows) {
        const s = String(r.roomNo || '').trim();
        const m = s.match(/^(.+?)([东西南北]单元)(.+)$/);
        const p = m
          ? { building: (m[1] || r.building || '').trim(), unit: m[2].trim(), room: m[3].trim() }
          : { building: r.building || '', unit: '', room: s };
        upd.run(p.building, p.unit, p.room, r.id);
      }
      sqlite.exec('COMMIT');
      console.log(`[migrate] 已拆分 ${rows.length} 位业主的楼栋/单元/房号`);
    } catch (e) {
      sqlite.exec('ROLLBACK');
      console.error('[migrate] 拆分房号失败: ' + e.message);
    }
  }
}

async function initSqlite() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  sqlite = new DatabaseSync(DB_PATH);
  // DELETE 日志模式避免容器重建时未 checkpoint 的 WAL 事务丢失
  try { sqlite.exec('PRAGMA journal_mode=DELETE'); } catch (e) { console.warn('[db] 设置 journal_mode 失败: ' + e.message); }
  sqlite.exec('PRAGMA busy_timeout = 5000;');
  sqlite.exec(SQLITE_SCHEMA);
  migrateSqliteColumns();
  console.log(`[db] SQLite ${DB_PATH}`);
}

async function initMysql() {
  const mysql = await import('mysql2/promise');
  pool = mysql.createPool({
    host: MYSQL.host,
    port: MYSQL.port,
    user: MYSQL.user,
    password: MYSQL.password,
    database: MYSQL.database,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true,
    dateStrings: true,
  });

  let lastError = null;
  for (let i = 0; i < 40; i++) {
    try {
      await pool.query('SELECT 1');
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (lastError) {
    throw new Error(`连接 MySQL 失败：${MYSQL.host}:${MYSQL.port}/${MYSQL.database} — ${lastError.message}`);
  }

  for (const sql of MYSQL_SCHEMA) await pool.query(sql);
  console.log(`[db] MySQL ${MYSQL.user}@${MYSQL.host}:${MYSQL.port}/${MYSQL.database}`);
}

export async function initDb() {
  if (IS_MYSQL) await initMysql();
  else await initSqlite();
  return { dialect: DRIVER, database: DRIVER, host: IS_MYSQL ? MYSQL.host : '', name: IS_MYSQL ? MYSQL.database : DB_PATH };
}

export const db = {
  get dialect() {
    return DRIVER;
  },
  async run(sql, params = []) {
    return IS_MYSQL ? mysqlExecutor(pool).run(sql, params) : sqliteExecutor(sqlite).run(sql, params);
  },
  async all(sql, params = []) {
    return IS_MYSQL ? mysqlExecutor(pool).all(sql, params) : sqliteExecutor(sqlite).all(sql, params);
  },
  async get(sql, params = []) {
    return IS_MYSQL ? mysqlExecutor(pool).get(sql, params) : sqliteExecutor(sqlite).get(sql, params);
  },
  async exec(sql) {
    return IS_MYSQL ? mysqlExecutor(pool).exec(sql) : sqliteExecutor(sqlite).exec(sql);
  },
  async transaction(fn) {
    if (!IS_MYSQL) {
      sqlite.exec('BEGIN');
      try {
        const result = await fn(sqliteExecutor(sqlite));
        sqlite.exec('COMMIT');
        return result;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(mysqlExecutor(conn));
      await conn.commit();
      return result;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },
  async close() {
    if (IS_MYSQL && pool) await pool.end();
    if (!IS_MYSQL && sqlite) sqlite.close();
  },
};

export function dbInfo() {
  return {
    driver: DRIVER,
    database: IS_MYSQL ? MYSQL.database : 'sqlite',
    host: IS_MYSQL ? MYSQL.host : '',
    path: IS_MYSQL ? '' : DB_PATH,
  };
}
