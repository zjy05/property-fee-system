import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { StoreContext } from '@/lib/store-context';
import type { IOwner, IReading, ISettings, ISyncState } from '@/data/types';
import { DEFAULT_SETTINGS } from '@/data/types';
import { apiFetch, isAuthed } from '@/lib/auth';

const CACHE_KEY = 'property-fee-print:cache';
const SYNC_INTERVAL = 5 * 60 * 1000; // 每 5 分钟自动同步一次

function inferBuilding(roomNo: string): string {
  const m = roomNo.match(/^(.+?楼)/);
  return m ? m[1] : '';
}

function parseBuildings(b: unknown): string[] {
  if (Array.isArray(b)) return b;
  if (typeof b === 'string') { try { const v = JSON.parse(b); return Array.isArray(v) ? v : [b]; } catch { return [b]; } }
  if (b) return [String(b)];
  return [];
}
function normalizeSettings(settings: Partial<ISettings>): ISettings {
  const paper = { ...DEFAULT_SETTINGS.paper, ...(settings.paper ?? {}) };
  // 老数据没有 paperProfiles：补上默认的 5 个；用户删空后传空数组则保持空
  const paperProfiles = Array.isArray(settings.paperProfiles)
    ? settings.paperProfiles.map((p, i) => ({
        ...DEFAULT_SETTINGS.paperProfiles[0],
        ...p,
        id: p.id || `paper-${Date.now()}-${i}`,
        name: p.name || `纸张 ${i + 1}`,
        width: Number(p.width) || 180,
        height: Number(p.height) || 210,
        marginTop: Number(p.marginTop) || 0,
        marginBottom: Number(p.marginBottom) || 0,
        marginLeft: Number(p.marginLeft) || 0,
        marginRight: Number(p.marginRight) || 0,
        lineHeight: Number(p.lineHeight) || 1.5,
        fontSize: Number(p.fontSize) || 14,
      }))
    : DEFAULT_SETTINGS.paperProfiles;
  const base: ISettings = { ...DEFAULT_SETTINGS, ...settings, paper, paperProfiles } as ISettings;
  if (Array.isArray(base.communities) && base.communities.length > 0) {
    return {
      ...base,
      communities: base.communities.map((c) => ({
        ...c,
        buildings: parseBuildings(c.buildings),
        hasTier: c.hasTier !== false,
        electricPrice: Number.isFinite(Number(c.electricPrice)) ? Number(c.electricPrice) : base.electricTier1Price,
        lineFee: Number.isFinite(Number(c.lineFee)) ? Number(c.lineFee) : 0,
      })),
    };
  }
  return {
    ...base,
    communities: [{ id: 'c-default', name: '演示小区', buildings: ['中楼'], waterPrice: base.waterPrice, garbageFee: base.garbageFee, hasTier: true, electricPrice: base.electricTier1Price, lineFee: 0 }],
  };
}

function normalizeOwners(owners: IOwner[]): IOwner[] {
  return owners.map((o) => {
    if (o.communityId) return o;
    const building = inferBuilding(o.roomNo);
    return { ...o, communityId: 'c-default', building };
  });
}

interface CacheShape {
  owners?: IOwner[];
  readings?: IReading[];
  settings?: Partial<ISettings>;
  savedAt?: string;
}

function readCache(): CacheShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheShape;
    if (!Array.isArray(parsed.owners)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(shape: CacheShape) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...shape, savedAt: new Date().toISOString() }));
  } catch { /* 缓存满/禁用时静默忽略 */ }
}

// 模块级读取一次浏览器缓存（页面加载即用，秒开 + 离线可见）
const initialCache = readCache();

function fmtTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function AppStoreProvider({ children }: { children: ReactNode }) {
  const [owners, setOwners] = useState<IOwner[]>(() => normalizeOwners(initialCache?.owners || []));
  const [readings, setReadings] = useState<IReading[]>(() => initialCache?.readings || []);
  const [settings, setSettings] = useState<ISettings>(() =>
    initialCache ? normalizeSettings(initialCache.settings || {}) : DEFAULT_SETTINGS,
  );
  // 登录态 state（登录/登出后由 auth-changed 事件驱动更新）
  const [authed, setAuthed] = useState(() => isAuthed());
  // 有登录态且无缓存时显示 loading，直到首次数据就绪；未登录不阻塞
  const [loading, setLoading] = useState(() => authed && !initialCache);
  const [syncState, setSyncState] = useState<ISyncState>({
    status: 'idle',
    lastSyncAt: null,
    serverTime: '',
  });
  // 已从服务端完整加载过数据；加载完成前禁止写回，防止登录瞬间覆盖真实数据
  const hydratedRef = useRef(false);
  // 正在编辑表单时跳过自动拉取，避免覆盖输入中的内容
  const editingRef = useRef(false);
  // 服务器时间与本地时钟的偏移（毫秒），校准后本地每秒 tick 显示
  const serverOffsetRef = useRef(0);
  // 服务端数据版本号（乐观锁）：写回时带上，过期则被拒并自动刷新
  const dataVersionRef = useRef<number | null>(null);
  // 最近一次服务端拉取的快照：若本地数据与之相同（无用户改动），禁止自动写回，
  // 防止多端/外部更新被旧快照覆盖（数据丢失根因）
  const lastPulledRef = useRef<{ owners: string; readings: string; settings: string } | null>(null);
  const [serverNow, setServerNow] = useState<Date | null>(null);

  // 监听是否正在编辑（输入框/下拉框获得焦点视为编辑中）
  useEffect(() => {
    const onFocusIn = (e: Event) => {
      const t = e.target as HTMLElement | null;
      editingRef.current = !!t?.closest?.('input,textarea,select,[contenteditable="true"]');
    };
    const onFocusOut = () => { editingRef.current = false; };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  // 监听登录态变化：登录/登出后触发数据拉取（登录页与主应用同挂一个 provider，
  // 首次加载 effect 在未登录时提前 return，登录后必须靠事件重新驱动）
  useEffect(() => {
    const onAuth = () => setAuthed(isAuthed());
    window.addEventListener('auth-changed', onAuth);
    return () => window.removeEventListener('auth-changed', onAuth);
  }, []);

  // 服务器时间每秒推进
  useEffect(() => {
    const t = window.setInterval(() => {
      if (serverOffsetRef.current !== 0) setServerNow(new Date(Date.now() + serverOffsetRef.current));
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  // 应用服务端数据到本地（并写入浏览器缓存）
  const applyServerData = useCallback((data: { owners?: IOwner[]; readings?: IReading[]; settings?: Partial<ISettings>; dataVersion?: number }) => {
    if (typeof data.dataVersion === 'number') dataVersionRef.current = data.dataVersion;
    hydratedRef.current = true;
    const ownersNext = normalizeOwners(data.owners || []);
    const readingsNext = data.readings || [];
    const settingsNext = normalizeSettings(data.settings || {});
    setOwners(ownersNext);
    setReadings(readingsNext);
    setSettings(settingsNext);
    lastPulledRef.current = {
      owners: JSON.stringify(ownersNext),
      readings: JSON.stringify(readingsNext),
      settings: JSON.stringify(settingsNext),
    };
    writeCache(data);
  }, []);

  // 从服务端拉取最新数据（自动同步核心）
  const pullData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isAuthed()) return;
    if (editingRef.current) return; // 正在输入，不打断
    setSyncState((s) => ({ ...s, status: 'syncing' }));
    try {
      const res = await apiFetch('/api/data');
      const data = await res.json();
      // 用 HTTP Date 头校准服务器时间
      const serverDate = res.headers.get('date');
      if (serverDate) {
        const serverMs = new Date(serverDate).getTime();
        if (!Number.isNaN(serverMs)) serverOffsetRef.current = serverMs - Date.now();
      }
      applyServerData(data);
      const now = new Date(Date.now() + serverOffsetRef.current);
      setSyncState({ status: 'synced', lastSyncAt: now, serverTime: fmtTime(now) });
      if (!opts?.silent) toast.success(`已同步 · ${fmtTime(now)}`);
    } catch {
      setSyncState((s) => ({ ...s, status: 'error' }));
    }
  }, [applyServerData]);

  // 首次加载：从服务端拉取最新数据（浏览器缓存已在 useState 初始化时展示）
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    apiFetch('/api/data')
      .then(async (res) => {
        const serverDate = res.headers.get('date');
        if (serverDate) {
          const serverMs = new Date(serverDate).getTime();
          if (!Number.isNaN(serverMs)) serverOffsetRef.current = serverMs - Date.now();
        }
        const data = await res.json();
        if (cancelled) return;
        applyServerData(data);
        const now = new Date(Date.now() + serverOffsetRef.current);
        setSyncState({ status: 'synced', lastSyncAt: now, serverTime: fmtTime(now) });
      })
      .catch(() => setSyncState((s) => ({ ...s, status: 'error' })))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // 登录后周期自动同步（每 5 分钟一次，带“已同步”提示）+ 窗口恢复焦点时静默同步
  useEffect(() => {
    if (!authed) return;
    const timer = window.setInterval(() => pullData(), SYNC_INTERVAL);
    const onFocus = () => pullData({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [authed, pullData]);

  // 本地改动 → 写回服务端（保持现有双向同步）
  const pullDataRef = useRef(pullData);
  useEffect(() => {
    pullDataRef.current = pullData;
  }, [pullData]);

  const sync = useCallback((key: string, value: unknown) => {
    if (!hydratedRef.current) return;
    const headers: Record<string, string> = {};
    if (dataVersionRef.current != null) headers['X-Client-Version'] = String(dataVersionRef.current);
    apiFetch(`/api/save/${key}`, { method: 'POST', body: JSON.stringify(value), headers })
      .then(async (res) => {
        if (res.status === 409) {
          // 数据已被其他端更新：拒绝写回并自动刷新
          toast.warning('检测到其他设备更新了数据，已自动刷新');
          pullDataRef.current({ silent: true });
          return;
        }
        if (res.ok) {
          // 关键：服务端每次保存都会把 dataVersion +1；这里必须同步到本地，
          // 否则下一次保存会带着旧版本号，被 409 拒绝后把刚改的设置拉回旧值。
          const data = await res.json().catch(() => null);
          if (data && typeof data.dataVersion === 'number') {
            dataVersionRef.current = data.dataVersion;
          }
          const now = new Date(Date.now() + serverOffsetRef.current);
          setSyncState({ status: 'synced', lastSyncAt: now, serverTime: fmtTime(now) });
        }
      })
      .catch(() => setSyncState((s) => ({ ...s, status: 'error' })));
  }, []);

  useEffect(() => {
    if (!loading && isAuthed() && lastPulledRef.current && JSON.stringify(owners) === lastPulledRef.current.owners) return;
    if (!loading && isAuthed()) sync('owners', owners);
  }, [owners, loading, sync]);
  useEffect(() => {
    if (!loading && isAuthed() && lastPulledRef.current && JSON.stringify(readings) === lastPulledRef.current.readings) return;
    if (!loading && isAuthed()) sync('readings', readings);
  }, [readings, loading, sync]);
  useEffect(() => {
    if (!loading && isAuthed() && lastPulledRef.current && JSON.stringify(settings) === lastPulledRef.current.settings) return;
    if (!loading && isAuthed()) {
      // 设置项（尤其纸张预览）可能连续点选，合并成一次保存，避免并发写回互相覆盖
      const t = window.setTimeout(() => sync('settings', settings), 250);
      return () => window.clearTimeout(t);
    }
  }, [settings, loading, sync]);

  const value = useMemo(
    () => ({ owners, readings, settings, setOwners, setReadings, setSettings, loading, syncState, serverNow }),
    [owners, readings, settings, loading, syncState, serverNow],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
