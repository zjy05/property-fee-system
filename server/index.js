import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { db, initDb, dbInfo, DATA_DIR } from './db.js';

const PORT = process.env.PORT || 4000;
// v1.6.0 支持桌面版（Electron）：数据目录/静态资源目录可由外部环境变量指定。
const APP_ROOT = process.env.APP_ROOT || process.cwd();
const CLIENT_DIR = process.env.CLIENT_DIR || path.join(APP_ROOT, 'dist/client');
fs.mkdirSync(DATA_DIR, { recursive: true });

// 先初始化数据库，再启动 HTTP 服务；MySQL 连接失败时应用直接报错，不会假装启动成功
await initDb();
const DB_INFO = dbInfo();

// ============================================================
// 旧版 JSON → SQLite 无损迁移（MySQL 模式下不再执行；生产迁移由专用脚本负责）
// ============================================================
async function migrateFromJson() {
  if (DB_INFO.driver !== 'sqlite') return false;
  const kvPath = path.join(DATA_DIR, 'kv.json');
  const usersPath = path.join(DATA_DIR, 'users.json');
  const ownersCount = (await db.get('SELECT COUNT(*) AS c FROM owners')).c;
  if (Number(ownersCount) > 0 || !fs.existsSync(kvPath)) return false;

  let kv = {};
  try { kv = JSON.parse(fs.readFileSync(kvPath, 'utf8')); } catch (e) {
    console.error('[migrate] kv.json 解析失败: ' + e.message);
    return false;
  }

  try {
    await db.transaction(async (tx) => {
      for (const o of kv.owners || []) {
        await tx.run(
          `INSERT INTO owners (id,name,roomNo,communityId,building,phone,waterMeterNo,electricMeterNo,propertyFee,createdAt)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [o.id, o.name ?? '', o.roomNo ?? '', o.communityId ?? '', o.building ?? '',
            o.phone ?? '', o.waterMeterNo ?? '', o.electricMeterNo ?? '', o.propertyFee ?? 0, o.createdAt ?? ''],
        );
      }
      for (const r of kv.readings || []) {
        await tx.run(
          `INSERT INTO readings (id,ownerId,period,receiptNo,waterPrev,waterCurr,electricPrev,electricCurr,
            waterUsage,electricUsage,yearElectricUsage,electricTier,waterAmount,electricAmount,propertyFee,garbageFee,totalAmount,paid,createdAt)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [r.id, r.ownerId ?? '', r.period ?? '', r.receiptNo ?? '',
            r.waterPrev ?? 0, r.waterCurr ?? 0, r.electricPrev ?? 0, r.electricCurr ?? 0,
            r.waterUsage ?? 0, r.electricUsage ?? 0, r.yearElectricUsage ?? 0, r.electricTier ?? '',
            r.waterAmount ?? 0, r.electricAmount ?? 0, r.propertyFee ?? 0, r.garbageFee ?? 0,
            r.totalAmount ?? 0, r.paid ? 1 : 0, r.createdAt ?? ''],
        );
      }
      for (const c of kv.communities || []) {
        await tx.run(
          `INSERT INTO communities (id,name,buildings,waterPrice,garbageFee) VALUES (?,?,?,?,?)`,
          [c.id, c.name ?? '', JSON.stringify(c.buildings || []), c.waterPrice ?? 0, c.garbageFee ?? 0],
        );
      }
      const settings = { ...(kv.settings || {}), communities: kv.communities || [] };
      for (const [k, v] of Object.entries(settings)) {
        await tx.run('INSERT INTO settings (setting_key,setting_value) VALUES (?,?)', [k, JSON.stringify(v)]);
      }
      let users = [];
      try { users = JSON.parse(fs.readFileSync(usersPath, 'utf8')); } catch { users = []; }
      for (const u of users) {
        await tx.run(
          `INSERT INTO users (id,username,password_hash,salt,role,community_id,permissions,created_at)
           VALUES (?,?,?,?,?,?,?,?)`,
          [u.id, u.username, u.password_hash, u.salt, u.role || 'user', u.community_id || '', '[]', u.created_at || ''],
        );
      }
    });

    if (fs.existsSync(kvPath)) fs.renameSync(kvPath, kvPath + '.pre-sqlite');
    if (fs.existsSync(usersPath)) fs.renameSync(usersPath, usersPath + '.pre-sqlite');
    console.log('[migrate] 旧版 JSON 数据已迁移到 SQLite，原文件已备份为 *.pre-sqlite');
    return true;
  } catch (e) {
    console.error('[migrate] 迁移失败: ' + e.message);
    return false;
  }
}
await migrateFromJson();

// 初始化 admin（数据库为空时）
const adminCount = Number((await db.get("SELECT COUNT(*) AS c FROM users WHERE role='admin'")).c);
if (adminCount === 0) {
  const salt = crypto.randomBytes(16).toString('hex');
  await db.run(
    'INSERT INTO users (id,username,password_hash,salt,role,community_id,permissions,created_at) VALUES (?,?,?,?,?,?,?,?)',
    [crypto.randomUUID(), 'admin', crypto.scryptSync('0', salt, 32).toString('hex'), salt, 'admin', '', '[]', new Date().toISOString()],
  );
  console.log('[init] 已创建默认管理员 admin（密码 0），请尽快修改');
}

// ---------- 工具函数 ----------
async function getSetting(key) {
  const row = await db.get('SELECT setting_value FROM settings WHERE setting_key=?', [key]);
  if (!row) return undefined;
  try { return JSON.parse(row.setting_value); } catch { return row.setting_value; }
}
async function setSetting(key, value) {
  const raw = JSON.stringify(value);
  if (db.dialect === 'mysql') {
    await db.run(
      'INSERT INTO settings (setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=?',
      [key, raw, raw],
    );
  } else {
    await db.run(
      'INSERT INTO settings (setting_key,setting_value) VALUES (?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value',
      [key, raw],
    );
  }
}
async function allSettings() {
  const rows = await db.all('SELECT setting_key,setting_value FROM settings');
  const out = {};
  for (const r of rows) {
    try { out[r.setting_key] = JSON.parse(r.setting_value); } catch { out[r.setting_key] = r.setting_value; }
  }
  return out;
}
async function getUsers() {
  return db.all('SELECT * FROM users');
}

// ---------- 账号权限 ----------
const ADMIN_ONLY_PERMISSIONS = new Set(['staff', 'loginLogs', 'settings']);
const ASSIGNABLE_PERMISSIONS = new Set([
  'dashboard', 'community', 'company', 'owners',
  'analysis', 'summary', 'payments', 'arrears', 'print',
]);
const ALL_PERMISSION_KEYS = [
  'dashboard', 'community', 'company', 'owners',
  'analysis', 'summary', 'payments', 'arrears', 'print',
  'staff', 'loginLogs', 'settings',
];

function normalizePermissions(input) {
  let list = input;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((key) => typeof key === 'string' && ASSIGNABLE_PERMISSIONS.has(key)))];
}

function userPermissions(user) {
  if (!user) return [];
  if (user.role === 'admin') return [...ALL_PERMISSION_KEYS];
  let stored = [];
  try { stored = JSON.parse(user.permissions || '[]'); } catch { stored = []; }
  return normalizePermissions(stored);
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    communityId: user.community_id || '',
    permissions: userPermissions(user),
  };
}

function allOwners() {
  return db.all('SELECT * FROM owners').then((rows) => rows.map(rowToOwner));
}
function allReadings() {
  return db.all('SELECT * FROM readings').then((rows) => rows.map(rowToReading));
}
function allCommunities() {
  return db.all('SELECT * FROM communities').then((rows) => rows.map(rowToCommunity));
}
function rowToOwner(r) {
  return { id: r.id, name: r.name, roomNo: r.roomNo, communityId: r.communityId, building: r.building,
    unit: r.unit ?? '', room: r.room ?? '',
    phone: r.phone, waterMeterNo: r.waterMeterNo, electricMeterNo: r.electricMeterNo, propertyFee: r.propertyFee, createdAt: r.createdAt };
}
function rowToReading(r) {
  return { id: r.id, ownerId: r.ownerId, period: r.period, receiptNo: r.receiptNo,
    waterPrev: r.waterPrev, waterCurr: r.waterCurr, electricPrev: r.electricPrev, electricCurr: r.electricCurr,
    waterUsage: r.waterUsage, electricUsage: r.electricUsage, yearElectricUsage: r.yearElectricUsage, electricTier: r.electricTier,
    waterAmount: r.waterAmount, electricAmount: r.electricAmount, lineAmount: r.lineAmount ?? 0, propertyFee: r.propertyFee, garbageFee: r.garbageFee,
    waterLoss: r.waterLoss ?? 0, electricLoss: r.electricLoss ?? 0,
    customName: r.customName ?? '', customPrev: r.customPrev ?? 0, customCurr: r.customCurr ?? 0,
    customUsage: r.customUsage ?? 0, customLoss: r.customLoss ?? 0, customPrice: r.customPrice ?? 0, customAmount: r.customAmount ?? 0,
    item1Name: r.item1Name ?? '', item1Amount: r.item1Amount ?? 0, item1Note: r.item1Note ?? '',
    item2Name: r.item2Name ?? '', item2Amount: r.item2Amount ?? 0, item2Note: r.item2Note ?? '',
    item3Name: r.item3Name ?? '', item3Amount: r.item3Amount ?? 0, item3Note: r.item3Note ?? '',
    lastBalance: r.lastBalance ?? 0, curBalance: r.curBalance ?? 0,
    paidAmount: r.paidAmount ?? 0, receiver: r.receiver ?? '', reader: r.reader ?? '', note: r.note ?? '',
    totalAmount: r.totalAmount, paid: !!r.paid, createdAt: r.createdAt };
}
function rowToCommunity(r) {
  let buildings = [];
  try { buildings = JSON.parse(r.buildings || '[]'); } catch {}
  return { id: r.id, name: r.name, buildings, waterPrice: r.waterPrice, garbageFee: r.garbageFee,
    hasTier: r.hasTier !== 0, electricPrice: r.electricPrice ?? 0, lineFee: r.lineFee ?? 0,
    waterLossRate: r.waterLossRate ?? 0, electricLossRate: r.electricLossRate ?? 0, customMeterName: r.customMeterName ?? '自定义' };
}

// 全量替换一张表（事务）
async function replaceTable(table, rows, toRow) {
  const clean = rows.map(toRow).filter(Boolean);
  await db.transaction(async (tx) => {
    await tx.run(`DELETE FROM ${table}`);
    if (clean.length === 0) return;
    const keys = Object.keys(clean[0]);
    const cols = keys.join(',');
    const marks = keys.map(() => '?').join(',');
    for (const row of clean) await tx.run(`INSERT INTO ${table} (${cols}) VALUES (${marks})`, keys.map((k) => row[k]));
  });
}

// 数据版本号（乐观锁）
async function getDataVersion() {
  const row = await db.get('SELECT setting_value FROM settings WHERE setting_key=?', ['dataVersion']);
  if (!row) return 0;
  try {
    const v = Number(JSON.parse(row.setting_value));
    return Number.isFinite(v) ? v : 0;
  } catch {
    const v = Number(row.setting_value);
    return Number.isFinite(v) ? v : 0;
  }
}
async function bumpDataVersion() {
  const v = (await getDataVersion()) + 1;
  await setSetting('dataVersion', v);
  return v;
}
function ownerToRow(o) {
  return { id: o.id, name: o.name ?? '', roomNo: o.roomNo ?? '', communityId: o.communityId ?? '', building: o.building ?? '',
    unit: o.unit ?? '', room: o.room ?? '',
    phone: o.phone ?? '', waterMeterNo: o.waterMeterNo ?? '', electricMeterNo: o.electricMeterNo ?? '', propertyFee: o.propertyFee ?? 0, createdAt: o.createdAt ?? '' };
}
function readingToRow(r) {
  return { id: r.id, ownerId: r.ownerId ?? '', period: r.period ?? '', receiptNo: r.receiptNo ?? '',
    waterPrev: r.waterPrev ?? 0, waterCurr: r.waterCurr ?? 0, electricPrev: r.electricPrev ?? 0, electricCurr: r.electricCurr ?? 0,
    waterUsage: r.waterUsage ?? 0, electricUsage: r.electricUsage ?? 0, yearElectricUsage: r.yearElectricUsage ?? 0, electricTier: r.electricTier ?? '',
    waterAmount: r.waterAmount ?? 0, electricAmount: r.electricAmount ?? 0, lineAmount: r.lineAmount ?? 0, propertyFee: r.propertyFee ?? 0, garbageFee: r.garbageFee ?? 0,
    waterLoss: r.waterLoss ?? 0, electricLoss: r.electricLoss ?? 0,
    customName: r.customName ?? '', customPrev: r.customPrev ?? 0, customCurr: r.customCurr ?? 0,
    customUsage: r.customUsage ?? 0, customLoss: r.customLoss ?? 0, customPrice: r.customPrice ?? 0, customAmount: r.customAmount ?? 0,
    item1Name: r.item1Name ?? '', item1Amount: r.item1Amount ?? 0, item1Note: r.item1Note ?? '',
    item2Name: r.item2Name ?? '', item2Amount: r.item2Amount ?? 0, item2Note: r.item2Note ?? '',
    item3Name: r.item3Name ?? '', item3Amount: r.item3Amount ?? 0, item3Note: r.item3Note ?? '',
    lastBalance: r.lastBalance ?? 0, curBalance: r.curBalance ?? 0,
    paidAmount: r.paidAmount ?? 0, receiver: r.receiver ?? '', reader: r.reader ?? '', note: r.note ?? '',
    totalAmount: r.totalAmount ?? 0, paid: r.paid ? 1 : 0, createdAt: r.createdAt ?? '' };
}
function communityToRow(c) {
  return { id: c.id, name: c.name ?? '', buildings: JSON.stringify(c.buildings || []), waterPrice: c.waterPrice ?? 0, garbageFee: c.garbageFee ?? 0,
    hasTier: c.hasTier ? 1 : 0, electricPrice: c.electricPrice ?? 0, lineFee: c.lineFee ?? 0,
    waterLossRate: c.waterLossRate ?? 0, electricLossRate: c.electricLossRate ?? 0, customMeterName: c.customMeterName ?? '自定义' };
}

// ---------- 认证 ----------
const sessions = new Map();
function hashPassword(pwd, salt) {
  return crypto.scryptSync(pwd, salt, 32).toString('hex');
}
async function getUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const userId = sessions.get(token);
  if (!userId) return null;
  return db.get('SELECT * FROM users WHERE id=?', [userId]);
}
async function requireAuth(req, res, next) {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: '未登录' });
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
}
async function recordLogin(req, username, success) {
  try {
    await db.run(
      'INSERT INTO login_logs (id,username,success,ip,user_agent,created_at) VALUES (?,?,?,?,?,?)',
      [crypto.randomUUID(), String(username || ''), success ? 1 : 0,
        String(req.ip || req.socket?.remoteAddress || ''), String(req.headers['user-agent'] || ''),
        new Date().toISOString()],
    );
  } catch (e) {
    console.error('[login-log] 写入失败: ' + e.message);
  }
}

// ---------- 应用 ----------
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(CLIENT_DIR));

app.get('/api/version', (req, res) => {
  let version = '1.2.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8'));
    if (pkg.version) version = pkg.version;
  } catch {}
  res.json({ version, name: '物业收费系统', database: DB_INFO.driver });
});

app.get('/api/time', (req, res) => {
  res.json({ time: new Date().toISOString() });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE username=?', [username]);
  if (!user || hashPassword(password || '', user.salt) !== user.password_hash) {
    await recordLogin(req, username, false);
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, user.id);
  await recordLogin(req, username, true);
  res.json({ token, user: publicUser(user) });
});

app.post('/api/logout', requireAuth, (req, res) => {
  sessions.delete((req.headers.authorization || '').replace('Bearer ', ''));
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post('/api/change-password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: '原密码和新密码必填' });
  if (String(newPassword).length < 6) return res.status(400).json({ error: '新密码至少 6 位' });
  const user = await db.get('SELECT * FROM users WHERE id=?', [req.user.id]);
  if (!user || hashPassword(oldPassword, user.salt) !== user.password_hash) {
    return res.status(400).json({ error: '原密码不正确' });
  }
  const salt = crypto.randomBytes(16).toString('hex');
  await db.run('UPDATE users SET password_hash=?, salt=? WHERE id=?', [hashPassword(newPassword, salt), salt, user.id]);
  res.json({ ok: true });
});

app.get('/api/login-logs', requireAuth, requireAdmin, async (req, res) => {
  const rows = await db.all('SELECT * FROM login_logs ORDER BY created_at DESC LIMIT 300');
  res.json({ logs: rows });
});

app.get('/api/data', requireAuth, async (req, res) => {
  const settings = await allSettings();
  const communities = await allCommunities();
  let owners = await allOwners();
  let readings = await allReadings();
  // 只有拿到业务页面权限的员工才下发业主/抄表数据；只有改密码权限的账号拿不到业务明细
  const dataPermissions = new Set(['dashboard', 'owners', 'analysis', 'summary', 'payments', 'arrears', 'print']);
  const canReadData = req.user.role === 'admin' || userPermissions(req.user).some((p) => dataPermissions.has(p));
  if (!canReadData) {
    owners = [];
    readings = [];
  }
  if (req.user.role !== 'admin' && req.user.community_id) {
    owners = owners.filter((o) => o.communityId === req.user.community_id);
    const ownerIds = new Set(owners.map((o) => o.id));
    readings = readings.filter((r) => ownerIds.has(r.ownerId));
  }
  res.json({ owners, readings, settings: { ...settings, communities }, communities, dataVersion: await getDataVersion() });
});

app.post('/api/save/:key', requireAuth, requireAdmin, async (req, res) => {
  const { key } = req.params;
  const value = req.body;
  if (!['owners', 'readings', 'settings', 'communities'].includes(key)) {
    return res.status(400).json({ error: '非法 key' });
  }
  try {
    // 乐观锁：客户端提交版本 < 服务端版本 = 数据已被其他端更新，拒绝写回
    const clientV = Number(req.headers['x-client-version'] ?? -1);
    const serverV = await getDataVersion();
    if (clientV >= 0 && clientV < serverV) {
      return res.status(409).json({ error: '数据已被其他设备更新，请刷新后再试', dataVersion: serverV });
    }
    if (key === 'owners') await replaceTable('owners', value, ownerToRow);
    else if (key === 'readings') await replaceTable('readings', value, readingToRow);
    else if (key === 'communities') {
      await replaceTable('communities', value, communityToRow);
      await setSetting('communities', value);
    } else if (key === 'settings') {
      const s = { ...value };
      // 不反向写回 communities 表：小区数据只通过 /api/save/communities 显式管理
      delete s.communities;
      for (const [k, v] of Object.entries(s)) await setSetting(k, v);
    }
    await bumpDataVersion();
    return res.json({ ok: true, dataVersion: await getDataVersion() });
  } catch (e) {
    console.error('[save:' + key + '] 失败: ' + e.message);
    res.status(500).json({ error: '保存失败' });
  }
});

app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await getUsers();
  res.json({ users: users.map(publicUser) });
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { username, password, communityId, permissions } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' });
  if (String(password).length < 6) return res.status(400).json({ error: '初始密码至少 6 位' });
  const exists = await db.get('SELECT id FROM users WHERE username=?', [username]);
  if (exists) return res.status(400).json({ error: '用户名已存在' });
  const salt = crypto.randomBytes(16).toString('hex');
  await db.run(
    'INSERT INTO users (id,username,password_hash,salt,role,community_id,permissions,created_at) VALUES (?,?,?,?,?,?,?,?)',
    [crypto.randomUUID(), username, hashPassword(password, salt), salt, 'user', communityId || '', JSON.stringify(normalizePermissions(permissions)), new Date().toISOString()],
  );
  res.json({ ok: true });
});

app.put('/api/users/:id/permissions', requireAuth, requireAdmin, async (req, res) => {
  const target = await db.get('SELECT * FROM users WHERE id=?', [req.params.id]);
  if (!target) return res.status(404).json({ error: '账号不存在' });
  if (target.role === 'admin') return res.status(400).json({ error: '管理员默认拥有全部权限，不能改为受限账号' });
  const next = normalizePermissions(req.body?.permissions);
  await db.run('UPDATE users SET permissions=? WHERE id=?', [JSON.stringify(next), target.id]);
  res.json({ ok: true, permissions: next });
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  if (req.user.id === req.params.id) return res.status(400).json({ error: '不能删除自己' });
  await db.run('DELETE FROM users WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/*splat', (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[server] ' + (err?.stack || err));
  if (res.headersSent) return next(err);
  res.status(500).json({ error: '服务器错误' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`物业收费系统 (${DB_INFO.driver}) running on http://0.0.0.0:${PORT}`);
});

async function shutdown() {
  server.close();
  try { await db.close(); } catch { /* ignore */ }
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
