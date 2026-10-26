import { useAppStore } from '@/lib/store-context';
import { useSidebar } from '@/components/ui/sidebar';

function fmtTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 左下角数据同步状态栏：实时同步标识 + 服务器时间 + 上次同步时间 */
export function SyncStatusBar() {
  const { syncState, serverNow } = useAppStore();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const status = syncState.status;
  const dotColor =
    status === 'synced'
      ? 'bg-emerald-500'
      : status === 'syncing'
        ? 'bg-amber-500 animate-pulse'
        : status === 'error'
          ? 'bg-red-500'
          : 'bg-zinc-400';
  const label =
    status === 'synced' ? '实时同步' : status === 'syncing' ? '同步中…' : status === 'error' ? '同步异常' : '未同步';

  const now = serverNow ?? new Date();
  const timeStr = fmtTime(now);
  const lastStr = syncState.lastSyncAt ? fmtTime(syncState.lastSyncAt) : '--:--:--';

  // 折叠态：只显示状态点
  if (collapsed) {
    return (
      <div className="flex justify-center pb-3">
        <span className={`size-2 rounded-full ${dotColor}`} title={label} />
      </div>
    );
  }

  return (
    <div className="border-t px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <span className={`size-2 shrink-0 rounded-full ${dotColor}`} />
        <span>{label}</span>
        <span className="ml-auto font-mono tabular-nums text-muted-foreground">{timeStr}</span>
      </div>
      <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
        上次同步 {lastStr} · 服务器时间
      </p>
    </div>
  );
}
