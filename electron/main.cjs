// Electron 桌面版主进程（v1.6.0）
// 思路：把现有的 Express + SQLite 后端在进程内跑起来，再用 Electron 窗口加载同一个界面。
// 这样桌面版和云端版共用 100% 的业务代码，只是把「服务器」搬到了本地。
const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const http = require('node:http');
const { pathToFileURL } = require('node:url');

// 打包后 __dirname 在 resources/app/electron，项目根在上一层
const APP_ROOT = path.join(__dirname, '..');
const CLIENT_DIR = path.join(APP_ROOT, 'dist', 'client');
// 数据放在用户目录（Windows: %APPDATA%），升级/重装不丢
const DATA_DIR = path.join(app.getPath('userData'), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(port, timeoutMs) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/api/version', timeout: 800 }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) return reject(new Error('本地服务启动超时'));
        setTimeout(tick, 250);
      });
      req.on('timeout', () => req.destroy());
    };
    tick();
  });
}

let mainWindow = null;

app.whenReady().then(async () => {
  try {
    const port = await findFreePort();
    process.env.APP_ROOT = APP_ROOT;
    process.env.CLIENT_DIR = CLIENT_DIR;
    process.env.DATA_DIR = DATA_DIR;
    process.env.PORT = String(port);

    // 直接加载现有 ESM 后端（它会自己 listen）
    await import(pathToFileURL(path.join(APP_ROOT, 'server', 'index.js')).href);
    await waitForServer(port, 30000);

    mainWindow = new BrowserWindow({
      width: 1440,
      height: 920,
      minWidth: 1100,
      minHeight: 700,
      title: '物业收费系统',
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.cjs'),
      },
    });
    const url = 'http://127.0.0.1:' + port;
    console.log('[desktop] LOCAL_URL ' + url);
    mainWindow.loadURL(url);

    // 外链用系统浏览器打开，别在应用里跑
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    mainWindow.on('closed', () => { mainWindow = null; });

    // ===== 打印能力（桌面版独有：静默、精确纸张、不需要外部打印助手） =====
    // 渲染进程通过 window.desktop.print() 调用；这里用 Electron 的打印接口，
    // pageSize 用微米（1mm = 1000），所以 180mm = 180000，能精确锁死三联纸尺寸。
    ipcMain.handle('print:printers', async () => {
      try {
        const list = await mainWindow.webContents.getPrintersAsync();
        return list.map((p) => ({ name: p.name, isDefault: !!p.isDefault, status: p.status }));
      } catch (e) {
        return [];
      }
    });

    ipcMain.handle('print:run', async (event, opts) => {
      return new Promise((resolve) => {
        if (!mainWindow) return resolve({ ok: false, error: '窗口已关闭' });
        const widthMm = Number(opts && opts.widthMm) || 180;
        const heightMm = Number(opts && opts.heightMm) || 210;
        const printOpts = {
          silent: true,          // 不弹打印对话框
          printBackground: true,
          pageSize: { width: Math.round(widthMm * 1000), height: Math.round(heightMm * 1000) },
        };
        if (opts && opts.printer) printOpts.deviceName = opts.printer;
        try {
          mainWindow.webContents.print(printOpts, (success, failureReason) => {
            resolve({ ok: success, error: failureReason || '' });
          });
        } catch (e) {
          resolve({ ok: false, error: String(e && e.message ? e.message : e) });
        }
      });
    });
  } catch (e) {
    dialog.showErrorBox('启动失败', String(e && e.message ? e.message : e));
    app.quit();
  }
});

app.on('window-all-closed', () => app.quit());
