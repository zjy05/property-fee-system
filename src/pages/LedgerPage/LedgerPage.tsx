import { useMemo, useState } from 'react';
import { AlertTriangle, BookOpenText, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/lib/store-context';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { currentPeriod, formatMoney, periodLabel } from '@/lib/fee';
import FeeTab from './sections/FeeTab';
import OwnersTab from './sections/OwnersTab';

export default function LedgerPage() {
  const { owners, readings, settings } = useAppStore();
  const user = getCurrentUser();
  const showOwnersTab = canAccess(user, 'owners');
  const [tab, setTab] = useState('fees');
  const activeTab = showOwnersTab ? tab : 'fees';

  const periods = useMemo(
    () => [...new Set(readings.map((r) => r.period))].sort().reverse(),
    [readings],
  );
  // 初始留空：优先展示最新有数据的账期；用户手动选后再按所选
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const activePeriod = periods.includes(selectedPeriod) ? selectedPeriod : (periods[0] ?? currentPeriod());

  // 分级筛选：状态 → 小区 → 楼栋（__all 表示不限）
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [communityFilter, setCommunityFilter] = useState('__all');
  const [buildingFilter, setBuildingFilter] = useState('__all');

  const communities = settings.communities;
  const buildingOptions =
    communityFilter && communityFilter !== '__all'
      ? (communities.find((c) => c.id === communityFilter)?.buildings ?? [])
      : [];

  const periodRows = readings.filter((r) => r.period === activePeriod);
  const filteredRows = periodRows.filter((r) => {
    if (statusFilter === 'paid' && !r.paid) return false;
    if (statusFilter === 'unpaid' && r.paid) return false;
    const owner = owners.find((o) => o.id === r.ownerId);
    if (communityFilter && communityFilter !== '__all' && owner?.communityId !== communityFilter) {
      return false;
    }
    if (buildingFilter && buildingFilter !== '__all' && owner?.building !== buildingFilter) {
      return false;
    }
    return true;
  });

  const receivable = filteredRows.reduce((sum, r) => sum + r.totalAmount, 0);
  const received = filteredRows.filter((r) => r.paid).reduce((sum, r) => sum + r.totalAmount, 0);
  const unpaid = receivable - received;

  const summary = [
    { label: '本期应收', value: receivable, className: 'text-foreground' },
    { label: '本期已收', value: received, className: 'text-primary' },
    { label: '本期未收', value: unpaid, className: unpaid > 0 ? 'text-destructive' : 'text-foreground' },
    { label: '记录户数', value: filteredRows.length, money: false },
  ];

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4">
      {settings.demoSeeded && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>当前为示例数据</AlertTitle>
          <AlertDescription>
            系统预置了演示业主与记录，可在「设置」页清空示例数据或导入你自己的数据。
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="fees">
            <BookOpenText className="size-4" />
            收费台账
          </TabsTrigger>
          {showOwnersTab && (
            <TabsTrigger value="owners">
              <Users className="size-4" />
              业主档案
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {activeTab === 'fees' ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={communityFilter}
              onValueChange={(v) => {
                setCommunityFilter(v);
                setBuildingFilter('__all');
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">全部小区</SelectItem>
                {communities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={buildingFilter}
              onValueChange={setBuildingFilter}
              disabled={communityFilter === '__all'}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">全部楼栋</SelectItem>
                {buildingOptions.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {summary.map((s) => (
              <Card key={s.label}>
                <CardContent className="flex flex-col gap-1 p-4">
                  <span className="text-xs text-muted-foreground">
                    {s.label}
                    {s.label === '本期应收' && periods.length > 0 && (
                      <span className="ml-1">（{periodLabel(activePeriod)}）</span>
                    )}
                  </span>
                  <span className={`text-xl font-semibold tabular-nums ${s.className}`}>
                    {s.money === false ? s.value : `${formatMoney(s.value)} 元`}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">按期次查看收费台账</p>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as 'all' | 'paid' | 'unpaid')}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="paid">已缴</SelectItem>
                  <SelectItem value="unpaid">未缴</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={activePeriod} onValueChange={setSelectedPeriod}>
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

          <FeeTab
            period={activePeriod}
            status={statusFilter}
            communityId={communityFilter === '__all' ? '' : communityFilter}
            building={buildingFilter === '__all' ? '' : buildingFilter}
          />
        </>
      ) : (
        <OwnersTab />
      )}
    </div>
  );
}
