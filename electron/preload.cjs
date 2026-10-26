// 预加载脚本：在渲染进程里安全地暴露桌面能力（打印、打印机列表）
// 注意：contextIsolation 开启，只能用 contextBridge 暴露白名单接口
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
  /** 取本机打印机列表 */
  getPrinters: () => ipcRenderer.invoke('print:printers'),
  /**
   * 静默打印当前窗口（打印中心页）
   * @param {{ widthMm?: number, heightMm?: number, printer?: string }} opts
   */
  print: (opts) => ipcRenderer.invoke('print:run', opts || {}),
});
