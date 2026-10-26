import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, CalendarDays, TrendingUp, Users, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAppStore } from '@/lib/store-context';
import { getCurrentUser } from '@/lib/auth';
import { canAccess, type PermissionKey } from '@/lib/permissions';
import { currentPeriod, formatMoney, periodLabel } from '@/lib/fee';

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/** 平台数据 / 运营分析共用的分析视图 */
export function AnalyticsView({ title = '平台数据', showQuickLinks = false }: { title?: string; showQuickLinks?: boolean }) {
  const { owners, readings, settings } = useAppStore();
  const user = getCurrentUser();
  const quickLinks: { to: string; label: string; permission: PermissionKey }[] = [
    { to: '/ledger/summary', label: '收费台账', permission: 'summary' },
    { to: '/assets/owners', label: '业主档案', permission: 'owners' },
    { to: '/ledger/arrears', label: '欠费清单', permission: 'arrears' },
    { to: '/print', label: '打印中心', permission: 'print' },
  ];
  const visibleQuickLinks = quickLinks.filter((l) => canAccess(user, l.permission));
  const periods = useMemo(
    () => [...new Set(readings.map((r) => r.period))].sort().reverse(),
    [readings],
  );
  // 初始留空：等数据加载后优先用「最新有数据的账期」，而不是当前自然月
  const [period, setPeriod] = useState('');
  const activePeriod = periods.includes(period) ? period : (periods[0] ?? currentPeriod());

  const rows = readings.filter((r) => r.period === activePeriod);
  const receivable = rows.reduce((s, r) => s + (r.totalAmount ?? 0), 0);
  const received = rows.filter((r) => r.paid).reduce((s, r) => s + (r.totalAmount ?? 0), 0);
  const unpaid = receivable - received;
  const rate = pct(received, receivable);

  const communityRows = settings.communities.map((c) => {
    const ownerIds = new Set(owners.filter((o) => o.communityId === c.id).map((o) => o.id));
    const list = rows.filter((r) => ownerIds.has(r.ownerId));
    const due = list.reduce((s, r) => s + (r.totalAmount ?? 0), 0);
    const got = list.filter((r) => r.paid).reduce((s, r) => s + (r.totalAmount ?? 0), 0);
    return { ...c, owners: ownerIds.size, due, got, unpaid: due - got, rate: pct(got, due) };
  });

  const recent = periods.slice(0, 6).reverse();
  const recentMax = Math.max(1, ...recent.map((p) => readings.filter((r) => r.period === p).reduce((s, r) => s + (r.totalAmount ?? 0), 0)));

  const cards = [
    { label: '小区数', value: settings.communities.length, icon: Building2, suffix: '' },
    { label: '业主档案', value: owners.length, icon: Users, suffix: ' 户' },
    { label: `${periodLabel(activePeriod)}应收`, value: receivable, icon: Wallet, suffix: ' 元' },
    { label: `${periodLabel(activePeriod)}实收`, value: received, icon: TrendingUp, suffix: ' 元' },
    { label: '收缴率', value: rate, icon: TrendingUp, suffix: ' %' },
    { label: '未收金额', value: unpaid, icon: CalendarDays, suffix: ' 元' },
  ];

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            当前数据：{settings.companyOrg || settings.companyName} · {settings.communities.length} 个小区 · {owners.length} 户
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">账期</span>
          <Select value={activePeriod} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.length === 0 && <SelectItem value={currentPeriod()}>{periodLabel(currentPeriod())}</SelectItem>}
              {periods.map((p) => (
                <SelectItem key={p} value={p}>
                  {periodLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{c.label}</span>
                <c.icon className="size-4" />
              </div>
              <span className="text-xl font-semibold tabular-nums">
                {c.suffix === ' 元' ? formatMoney(c.value) : c.value}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">{c.suffix}</span>
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">小区费用汇总</CardTitle>
            <CardDescription>按小区看本期应收、实收和欠费。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>小区</TableHead>
                    <TableHead className="text-right">户数</TableHead>
                    <TableHead className="text-right">应收</TableHead>
                    <TableHead className="text-right">实收</TableHead>
                    <TableHead className="text-right">欠费</TableHead>
                    <TableHead className="text-right">收缴率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {communityRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                        还没有小区，请到「数据 → 小区信息」添加
                      </TableCell>
                    </TableRow>
                  )}
                  {communityRows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.owners}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(c.due)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(c.got)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${c.unpaid > 0 ? 'text-destructive' : ''}`}>
                        {formatMoney(c.unpaid)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={c.rate >= 90 ? 'default' : c.rate >= 60 ? 'secondary' : 'destructive'}>
                          {c.rate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">近 6 个账期应收</CardTitle>
            <CardDescription>看趋势，不只看本月。</CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">还没有抄表/收费记录</p>
            ) : (
              <div className="flex h-44 items-end gap-2">
                {recent.map((p) => {
                  const total = readings.filter((r) => r.period === p).reduce((s, r) => s + (r.totalAmount ?? 0), 0);
                  return (
                    <div key={p} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] tabular-nums text-muted-foreground">{formatMoney(total)}</span>
                      <div className="flex h-28 w-full items-end rounded-sm bg-muted">
                        <div
                          className="w-full rounded-sm bg-primary/80"
                          style={{ height: `${Math.max(4, (total / recentMax) * 100)}%` }}
                          title={`${periodLabel(p)}：${formatMoney(total)} 元`}
                        />
                      </div>
                      <span className="whitespace-nowrap text-[10px] text-muted-foreground">{periodLabel(p)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showQuickLinks && visibleQuickLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">快捷入口</CardTitle>
            <CardDescription>常用操作放在首页，少点几次。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {visibleQuickLinks.map((l) => (
              <Button key={l.to} asChild variant="outline">
                <Link to={l.to}>{l.label} <ArrowRight className="size-4" /></Link>
              </Button>
            ))}
            {visibleQuickLinks.length === 0 && (
              <span className="text-sm text-muted-foreground">暂无可快捷进入的页面</span>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return <AnalyticsView title="平台数据" showQuickLinks />;
}
