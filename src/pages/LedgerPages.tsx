import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BarChart3, Search, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAppStore } from '@/lib/store-context';
import { getCurrentUser } from '@/lib/auth';
import { canAccess, isAdmin } from '@/lib/permissions';
import { formatMoney, periodLabel } from '@/lib/fee';
import { fullRoomNo } from '@/lib/owner';
import LedgerPage from '@/pages/LedgerPage/LedgerPage';
import { AnalyticsView } from '@/pages/DashboardPage';

export function LedgerSummaryPage() {
  const readOnly = !isAdmin(getCurrentUser());
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Wallet className="size-5" /> 小区费用汇总
          {readOnly && <Badge variant="outline">只读</Badge>}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {readOnly
            ? '按账期、小区、楼栋查看收费台账；员工账号不能录入或修改。'
            : '按账期、小区、楼栋筛选收费台账；录入抄表、标记收款、打印收据都在这里。'}
        </p>
      </div>
      <LedgerPage />
    </div>
  );
}

export function LedgerAnalysisPage() {
  return <AnalyticsView title="运营分析" />;
}

type RecordKind = 'paid' | 'unpaid';

function RecordTable({ kind }: { kind: RecordKind }) {
  const { owners, readings, settings } = useAppStore();
  const user = getCurrentUser();
  const canPrint = canAccess(user, 'print');
  const [keyword, setKeyword] = useState('');
  const [period, setPeriod] = useState('__all');

  const periods = useMemo(
    () => [...new Set(readings.map((r) => r.period))].sort().reverse(),
    [readings],
  );

  const rows = useMemo(() => {
    const kw = keyword.trim();
    return readings
      .filter((r) => (kind === 'paid' ? r.paid : !r.paid))
      .filter((r) => period === '__all' || r.period === period)
      .map((r) => ({ reading: r, owner: owners.find((o) => o.id === r.ownerId) }))
      .filter((x): x is { reading: typeof readings[number]; owner: NonNullable<typeof x.owner> } => Boolean(x.owner))
      .filter(({ reading, owner }) => {
        if (!kw) return true;
        return (
          owner.name.includes(kw) ||
          fullRoomNo(owner).includes(kw) ||
          reading.period.includes(kw)
        );
      })
      .sort((a, b) => b.reading.period.localeCompare(a.reading.period));
  }, [readings, owners, kind, period, keyword]);

  const communityName = (id: string) => settings.communities.find((c) => c.id === id)?.name ?? '未分小区';
  const total = rows.reduce((s, x) => s + (x.reading.totalAmount ?? 0), 0);
  const title = kind === 'paid' ? '缴费记录' : '小区欠费';
  const Icon = kind === 'paid' ? Wallet : AlertTriangle;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Icon className="size-5" /> {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {kind === 'paid' ? '已收款记录，按账期倒序。' : '未收款记录，可按姓名/房号/账期搜索。'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="姓名 / 房号 / 账期"
              className="w-56 pl-8"
            />
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="__all">全部账期</option>
            {periods.map((p) => (
              <option key={p} value={p}>
                {periodLabel(p)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">共 {rows.length} 条</CardTitle>
            <CardDescription>合计 {formatMoney(total)} 元</CardDescription>
          </div>
          <Badge variant={kind === 'paid' ? 'default' : 'destructive'}>
            {kind === 'paid' ? '已收' : '未收'}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>小区</TableHead>
                  <TableHead>楼栋 / 单元 / 房号</TableHead>
                  <TableHead>账期</TableHead>
                  <TableHead className="text-right">应收</TableHead>
                  <TableHead className="text-right">实收</TableHead>
                  <TableHead>缴费日期</TableHead>
                  {canPrint && <TableHead className="text-right">操作</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canPrint ? 8 : 7} className="h-24 text-center text-muted-foreground">
                      没有符合条件的记录
                    </TableCell>
                  </TableRow>
                )}
                {rows.map(({ reading, owner }) => (
                  <TableRow key={reading.id}>
                    <TableCell className="font-medium">{owner.name}</TableCell>
                    <TableCell>{communityName(owner.communityId)}</TableCell>
                    <TableCell>{[owner.building, owner.unit, owner.room].filter(Boolean).join(' / ') || fullRoomNo(owner)}</TableCell>
                    <TableCell>{periodLabel(reading.period)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(reading.totalAmount ?? 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(reading.paidAmount ?? (reading.paid ? reading.totalAmount : 0))}
                    </TableCell>
                    <TableCell>{reading.paidDate || (reading.paid ? '已标记' : '—')}</TableCell>
                    {canPrint && (
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/print?readingId=${reading.id}`}>打印 <ArrowRight className="size-3.5" /></Link>
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        {canAccess(user, 'summary') && (
          <Button asChild variant="outline">
            <Link to="/ledger/summary">去收费台账 <ArrowRight className="size-4" /></Link>
          </Button>
        )}
        {canAccess(user, kind === 'paid' ? 'arrears' : 'payments') && (
          <Button asChild variant="outline">
            <Link to={kind === 'paid' ? '/ledger/arrears' : '/ledger/payments'}>
              {kind === 'paid' ? '看欠费' : '看缴费记录'} <ArrowRight className="size-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function PaymentRecordsPage() {
  return <RecordTable kind="paid" />;
}

export function ArrearsPage() {
  return <RecordTable kind="unpaid" />;
}

export function LedgerOverviewCards() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-4" /> 台账口径
        </CardTitle>
        <CardDescription>应收 = 本期抄表计算合计；实收 = 已标记收款；欠费 = 应收 - 实收。</CardDescription>
      </CardHeader>
    </Card>
  );
}
