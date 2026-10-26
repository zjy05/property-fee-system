/**
 * 桌面版（Electron）桥接。
 * 只有用 PropertyFee.exe 启动时 window.desktop 才存在；
 * 浏览器访问时返回 null，界面自动退回原有逻辑。
 */
export interface DesktopBridge {
  isDesktop: true;
  platform: string;
  getPrinters: () => Promise<{ name: string; isDefault: boolean }[]>;
  print: (opts: { widthMm?: number; heightMm?: number; printer?: string }) => Promise<{ ok: boolean; error?: string }>;
}

export function getDesktop(): DesktopBridge | null {
  if (typeof window === 'undefined') return null;
  const d = (window as unknown as { desktop?: DesktopBridge }).desktop;
  return d && d.isDesktop ? d : null;
}
