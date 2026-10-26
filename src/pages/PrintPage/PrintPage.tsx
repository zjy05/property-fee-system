import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer, Search, LayoutGrid, FileText, Settings2, X, Trash2, RotateCcw, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/lib/store-context';
import type { IOwner, IReading } from '@/data/types';
import { pingPrintAgent, sendPrintJob } from '@/lib/print-agent';
import type { AgentHealth } from '@/lib/print-agent';
import { buildPrintJob } from '@/lib/receipt-draw';
import { getCurrentUser } from '@/lib/auth';
import { isAdmin, landingPath } from '@/lib/permissions';
import { getDesktop } from '@/lib/desktop';
import ReceiptPaper from './sections/ReceiptPaper';
import PrintSettingsPanel from './sections/PrintSettingsPanel';
import PrintPaperStyle from './sections/PrintPaperStyle';
import PaperProfileDialog from './sections/PaperProfileDialog';

type Mode = 'all' | 'single';

/** 老楼版式「年度合计」：按业主 + 年份汇总抄表用量（电/水） */
function sumYearUsage(
  readings: IReading[],
  ownerId: string,
  period: string,
  key: 'electricUsage' | 'waterUsage',
): number {
  const year = period.slice(0, 4);
  return readings
    .filter((r) => r.ownerId === ownerId && r.period.slice(0, 4) === year)
    .reduce((sum, r) => sum + (r[key] ?? 0), 0);
}

export default function PrintPage() {
  const { readings, owners, settings, setSettings } = useAppStore();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const admin = isAdmin(user);
  const [searchParams] = useSearchParams();
  // 台账「打印收据」跳转时带 readingId，直接定位到该户（single 模式）
  const urlReadingId = searchParams.get('readingId');
  // 默认单张预览：调纸张时能直接看到「一张纸」的真实宽高；批量仍可切「全部打印」
  const [mode, setMode] = useState<Mode>('single');
  const [keyword, setKeyword] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [paperMgrOpen, setPaperMgrOpen] = useState(false);
  // 批量打印时排除（不打印）的收据 id 集合
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  // 本地打印助手（针式直打）在线状态
  const [agent, setAgent] = useState<AgentHealth | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);
  // 桌面版（Electron）：内置静默打印，不需要外部打印助手
  const desktop = useMemo(() => getDesktop(), []);
  const [desktopBusy, setDesktopBusy] = useState(false);
  const [desktopPrinter, setDesktopPrinter] = useState('');
  useEffect(() => {
    if (!desktop) return;
    desktop
      .getPrinters()
      .then((list) => {
        const def = list.find((p) => p.isDefault) ?? list[0];
        setDesktopPrinter(def ? def.name : '');
      })
      .catch(() => setDesktopPrinter(''));
  }, [desktop]);

  // 每 8 秒探测一次本地打印助手；助手装在没有打印机的电脑上也不会报错，只是保持离线
  const refreshAgent = useCallback(async () => {
    setAgent(await pingPrintAgent());
  }, []);
  useEffect(() => {
    void refreshAgent();
    const t = window.setInterval(() => void refreshAgent(), 8000);
    return () => window.clearInterval(t);
  }, [refreshAgent]);

  const options = useMemo(
    () =>
      readings
        .map((r) => {
          const owner = owners.find((o) => o.id === r.ownerId);
          return { reading: r, owner };
        })
        .filter((x): x is { reading: IReading; owner: IOwner } => Boolean(x.owner))
        .sort((a, b) => b.reading.period.localeCompare(a.reading.period)),
    [readings, owners],
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim();
    if (!kw) return options;
    return options.filter(
      (o) =>
        o.owner.name.includes(kw) ||
        o.owner.roomNo.includes(kw) ||
        o.reading.period.includes(kw),
    );
  }, [options, keyword]);

  // 实际参与打印的收据（已排除的不打印）
  const printable = useMemo(
    () => options.filter((o) => !excludedIds.includes(o.reading.id)),
    [options, excludedIds],
  );

  // 全部模式预览列表：未搜索时显示未排除的收据；搜索时显示全部命中（含已排除户，便于单独恢复）
  const allPreview = useMemo(() => {
    const kw = keyword.trim();
    if (kw) return filtered;
    return options.filter((o) => !excludedIds.includes(o.reading.id));
  }, [options, filtered, excludedIds, keyword]);

  const single = useMemo(() => {
    // 用户主动搜索时优先搜索命中的第一条；未搜索且带 readingId（从台账跳转）时定位到该户
    if (!keyword.trim() && urlReadingId) {
      const opt = options.find((o) => o.reading.id === urlReadingId);
      if (opt) return opt;
    }
    return filtered[0] ?? options[0];
  }, [options, filtered, urlReadingId, keyword]);

  const excludeReading = (id: string) =>
    setExcludedIds((s) => (s.includes(id) ? s : [...s, id]));
  const restoreAll = () => setExcludedIds([]);

  const handlePrint = () => {
    window.print();
  };

  // 桌面版静默打印：Electron 直接把当前打印页送给针式打印机，锁死纸张尺寸、不弹对话框
  const handleDesktopPrint = async () => {
    if (!desktop) return;
    if (printable.length === 0) return;
    setDesktopBusy(true);
    try {
      const res = await desktop.print({
        widthMm: settings.paper.width,
        heightMm: settings.paper.height,
      });
      if (res.ok) {
        toast.success(
          '已送打印机' + (desktopPrinter ? '：' + desktopPrinter : '') + '（' +
            (mode === 'all' ? printable.length : 1) + ' 张）',
        );
      } else {
        toast.error('打印失败：' + (res.error || '未知原因'));
      }
    } finally {
      setDesktopBusy(false);
    }
  };

  // 针式直打：把票据指令逐个发给本地打印助手，由助手直接送针式打印机（无浏览器对话框）
  const handleAgentPrint = async () => {
    if (!agent?.canPrint) {
      toast.error('本地打印助手未就绪：请先在插着打印机的那台电脑上启动「打印助手」');
      return;
    }
    const targets = mode === 'all' ? printable : single ? [single] : [];
    if (targets.length === 0) return;

    setAgentBusy(true);
    let ok = 0;
    const failed: string[] = [];
    for (const o of targets) {
      const yearEle =
        o.reading.yearElectricUsage ||
        sumYearUsage(readings, o.owner.id, o.reading.period, 'electricUsage');
      const yearWater = sumYearUsage(readings, o.owner.id, o.reading.period, 'waterUsage');
      const job = buildPrintJob(o.reading, o.owner, settings, yearEle, yearWater);
      if (!job) {
        failed.push(o.owner.name + '（当前版式暂不支持直打，请用浏览器打印）');
        continue;
      }
      const res = await sendPrintJob({
        ...job,
        printer: settings.printerName?.trim() || undefined,
      });
      if (res.ok) ok += 1;
      else failed.push(o.owner.name + '：' + (res.error ?? '未知错误'));
    }
    setAgentBusy(false);

    if (ok > 0) toast.success('已直送针式打印机 ' + ok + ' 张');
    if (failed.length > 0) {
      toast.error('有 ' + failed.length + ' 张未打印：' + failed.slice(0, 3).join('；'));
    }
  };

  const empty = options.length === 0;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4">
      {/* 把「纸宽×纸高」写成精确的 @page 规则，三联纸才不会跑偏 */}
      <PrintPaperStyle paper={settings.paper} />
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
        <span className="font-medium text-muted-foreground">纸张预览</span>
        {admin && settings.paperProfiles.map((p) => {
          const active = settings.paper.width === p.width && settings.paper.height === p.height;
          const { id, name, ...paper } = p;
          return (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setSettings((prev) => ({ ...prev, paper }))}
              title={`${name}：${p.width}×${p.height}mm`}
            >
              {name}
              {!name.includes('×') && (
                <span className={active ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                  {p.width}×{p.height}
                </span>
              )}
            </Button>
          );
        })}
        {admin && settings.paperProfiles.length === 0 && (
          <span className="text-muted-foreground">还没有纸张，点右侧「管理纸张」添加</span>
        )}
        {admin && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setPaperMgrOpen(true)}
          >
            <Settings2 className="size-3.5" /> 管理纸张
          </Button>
        )}
        <span className="ml-auto text-muted-foreground">
          当前 {settings.paper.width}×{settings.paper.height}mm · 单张预览看纸张比例
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(landingPath(user))}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-lg font-semibold">打印中心</h1>
          <span className="text-xs text-muted-foreground">
            共 {options.length} 张收据
            {excludedIds.length > 0 && (
              <span className="ml-1 text-destructive">· 已排除 {excludedIds.length} 张</span>
            )}
          </span>
          {excludedIds.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={restoreAll}>
              <RotateCcw className="size-3.5" />
              恢复全部
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 模式切换 */}
          <div className="flex rounded-md border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={mode === 'all' ? 'default' : 'ghost'}
              onClick={() => setMode('all')}
              className="gap-1"
            >
              <LayoutGrid className="size-4" />
              全部打印
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'single' ? 'default' : 'ghost'}
              onClick={() => setMode('single')}
              className="gap-1"
            >
              <FileText className="size-4" />
              单户打印
            </Button>
          </div>
          {/* 快捷搜索：全部模式定位到户后可逐户移除；单户模式定位打印户 */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索姓名 / 房号 / 期次"
              className="w-56 pl-8"
            />
          </div>
          {desktop && (
            <Button
              type="button"
              onClick={handleDesktopPrint}
              disabled={printable.length === 0 || desktopBusy}
              title={
                '桌面版内置静默打印：纸张锁死 ' +
                settings.paper.width +
                '×' +
                settings.paper.height +
                'mm，不弹打印对话框' +
                (desktopPrinter ? '；默认打印机：' + desktopPrinter : '')
              }
            >
              <Printer className="size-4" />
              {desktopBusy ? '打印中…' : '静默打印'}
              {mode === 'all' ? '（' + printable.length + '张）' : ''}
            </Button>
          )}
          <Button
            type="button"
            variant={agent?.canPrint ? 'default' : 'outline'}
            onClick={handleAgentPrint}
            disabled={printable.length === 0 || agentBusy || !agent?.canPrint}
            title={
              agent?.canPrint
                ? '直接送针式打印机，不弹浏览器打印对话框（默认打印机：' + (agent.defaultPrinter || '系统默认') + '）'
                : '未检测到本地打印助手：请先在插着打印机的那台电脑上双击「启动打印助手.bat」'
            }
          >
            <Zap className="size-4" />
            {agentBusy ? '直打中…' : '针式直打'}
            {agent?.canPrint && mode === 'all' ? `（${printable.length}张）` : ''}
          </Button>
          <Button type="button" variant="outline" onClick={handlePrint} disabled={printable.length === 0}>
            <Printer className="size-4" />
            浏览器打印{mode === 'all' ? `（${printable.length}张）` : ''}
          </Button>
          {admin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen((v) => !v)}
              title="收起/展开打印参数"
            >
              {settingsOpen ? <X className="size-4" /> : <Settings2 className="size-4" />}
              {settingsOpen ? '收起参数' : '参数'}
            </Button>
          )}
        </div>
      </div>

      {empty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-muted-foreground">还没有可打印的收费记录</p>
            <Button type="button" onClick={() => navigate(landingPath(user))}>
              返回可查看页面
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div
          className={
            admin && settingsOpen
              ? 'grid items-start gap-4 lg:grid-cols-[1fr_280px]'
              : 'grid items-start'
          }
        >
          <div className="overflow-x-auto rounded-md bg-muted/40 p-4">
            {mode === 'all' ? (
              /* 全部模式：连续排列可打印收据，每张可单独移除（不打印该户） */
              <div className="print-all space-y-2">
                {allPreview.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {keyword.trim() ? '没有匹配的收据' : '已全部排除，请点击「恢复全部」'}
                  </p>
                ) : (
                  allPreview.map((o) => {
                    const excluded = excludedIds.includes(o.reading.id);
                    return (
                      <div key={o.reading.id} className="group relative">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            excluded
                              ? setExcludedIds((s) => s.filter((x) => x !== o.reading.id))
                              : excludeReading(o.reading.id)
                          }
                          title={excluded ? `恢复 ${o.owner.name}` : `排除 ${o.owner.name}（不打印）`}
                          className={`print:hidden absolute right-1 top-1 z-10 gap-1 opacity-0 transition-opacity group-hover:opacity-100 ${
                            excluded ? 'border-destructive/40 text-destructive' : ''
                          }`}
                        >
                          {excluded ? <RotateCcw className="size-3.5" /> : <Trash2 className="size-3.5" />}
                          {excluded ? '恢复' : '不打印'}
                        </Button>
                        <div className={excluded ? 'opacity-40' : ''}>
                          <ReceiptPaper
                            reading={o.reading}
                            owner={o.owner}
                            settings={settings}
                            yearElectricUsage={
                              o.reading.yearElectricUsage ||
                              sumYearUsage(readings, o.owner.id, o.reading.period, 'electricUsage')
                            }
                            yearWaterUsage={sumYearUsage(
                              readings,
                              o.owner.id,
                              o.reading.period,
                              'waterUsage',
                            )}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              single && (
                <div className="mx-auto w-fit">
                  <ReceiptPaper
                    reading={single.reading}
                    owner={single.owner}
                    settings={settings}
                    yearElectricUsage={
                      single.reading.yearElectricUsage ||
                      sumYearUsage(readings, single.owner.id, single.reading.period, 'electricUsage')
                    }
                    yearWaterUsage={sumYearUsage(
                      readings,
                      single.owner.id,
                      single.reading.period,
                      'waterUsage',
                    )}
                  />
                  <p className="print:hidden mt-2 text-center text-xs text-muted-foreground">
                    单张纸张：{settings.paper.width}×{settings.paper.height} mm
                  </p>
                </div>
              )
            )}
          </div>
          {admin && settingsOpen && (
            <div className="grid gap-4">
              <PrintSettingsPanel onManageProfiles={() => setPaperMgrOpen(true)} />
            </div>
          )}
        </div>
      )}
      {admin && <PaperProfileDialog open={paperMgrOpen} onOpenChange={setPaperMgrOpen} />}
    </div>
  );
}
