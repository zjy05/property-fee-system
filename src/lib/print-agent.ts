/**
 * 本地打印助手客户端（v1.4.0）
 *
 * 助手跑在「打印机插着的那台电脑」上，监听 127.0.0.1:18181。
 * 浏览器从任意来源（本机 / 局域网 / cpolar 公网 https）都能调用它：
 * 浏览器把 http://127.0.0.1 视为可信来源，HTTPS 页面调它不会被当成混合内容拦截。
 */

export const PRINT_AGENT_URL = 'http://127.0.0.1:18181';

export interface AgentHealth {
  ok: boolean;
  agent: string;
  version: string;
  /** 助手是否跑在 Windows 上 */
  windows: boolean;
  /** 是否具备真正的打印能力（非 Windows 上为 false，只能 dry-run） */
  canPrint: boolean;
  defaultPrinter: string;
}

/** 一条绘制指令，坐标单位毫米，原点在纸左上角 */
export type DrawOp =
  | {
      t: 'text';
      x: number;
      y: number;
      w: number;
      h: number;
      text: string;
      /** 字号(pt)，缺省 9 */
      size?: number;
      bold?: boolean;
      align?: 'left' | 'center' | 'right';
    }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number };

export interface PrintJob {
  /** 打印机名称，留空使用系统默认打印机 */
  printer?: string;
  copies?: number;
  paper: { widthMm: number; heightMm: number };
  ops: DrawOp[];
}

/** 探测打印助手是否在线（不在线返回 null，不抛异常） */
export async function pingPrintAgent(timeoutMs = 1500): Promise<AgentHealth | null> {
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(PRINT_AGENT_URL + '/health', { signal: ctrl.signal, cache: 'no-store' });
    window.clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as AgentHealth;
  } catch {
    return null;
  }
}

/** 把一张票据发给打印助手 */
export async function sendPrintJob(
  job: PrintJob,
  timeoutMs = 20000,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(PRINT_AGENT_URL + '/print', {
      method: 'POST',
      // 关键：用 text/plain 提交，浏览器视为「简单请求」，不会发 CORS 预检
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(job),
      signal: ctrl.signal,
    });
    window.clearTimeout(timer);
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) return { ok: false, error: data.error || '打印助手返回 HTTP ' + res.status };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
