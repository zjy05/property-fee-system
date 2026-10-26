import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Pencil, Printer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAppStore } from '@/lib/store-context';
import { getCurrentUser } from '@/lib/auth';
import { canAccess, isAdmin } from '@/lib/permissions';
import { formatMoney } from '@/lib/fee';
import ReadingDialog from './ReadingDialog';
import EditReadingDialog from './EditReadingDialog';

interface FeeTabProps {
  period: string;
  status: 'all' | 'paid' | 'unpaid';
  communityId: string;
  building: string;
}

export default function FeeTab({ period, status, communityId, building }: FeeTabProps) {
  const { readings, owners, setReadings } = useAppStore();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const readOnly = !isAdmin(user);
  const canPrint = canAccess(user, 'print');
  const showActionColumn = !readOnly || canPrint;
  const [readingOpen, setReadingOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const rows = readings
    .filter((r) => {
      if (r.period !== period) return false;
      if (status === 'paid' && !r.paid) return false;
      if (status === 'unpaid' && r.paid) return false;
      const owner = owners.find((o) => o.id === r.ownerId);
      if (communityId && owner?.communityId !== communityId) return false;
      if (building && owner?.building !== building) return false;
      return true;
    })
    .sort((a, b) => {
      const ao = owners.find((o) => o.id === a.ownerId);
      const bo = owners.find((o) => o.id === b.ownerId);
      return (ao?.roomNo ?? '').localeCompare(bo?.roomNo ?? '', 'zh-CN', { numeric: true });
    });

  const ownerName = (id: string) => owners.find((o) => o.id === id);

  const togglePaid = (id: string) => {
    setReadings((prev) =>
      prev.map((r) =>
        r.id === id
          ? (() => {
              const nextPaid = !r.paid;
              // 同步实收与本次结余
              const paidAmount = nextPaid ? (r.paidAmount ?? r.totalAmount) : 0;
              const curBalance =
                Math.round(((r.lastBalance ?? 0) + r.totalAmount - paidAmount) * 100) / 100;
              return {
                ...r,
                paid: nextPaid,
                paidDate: nextPaid ? r.paidDate ?? new Date().toISOString().slice(0, 10) : undefined,
                paidAmount,
                curBalance,
              };
            })()
          : r,
      ),
    );
    toast.success('缴费状态已更新');
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    setReadings((prev) => prev.filter((r) => r.id !== pendingDelete));
    toast.success('收费记录已删除');
    setPendingDelete(null);
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          共 {rows.length} 条收费记录
          {readOnly && <Badge variant="outline">只读</Badge>}
        </p>
        {!readOnly && (
          <Button onClick={() => setReadingOpen(true)}>
            <Check className="size-4" />
            抄表录入
          </Button>
        )}
      </div>

      <div className="w-full overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">业主</TableHead>
              <TableHead className="whitespace-nowrap text-right">水用量/水费</TableHead>
              <TableHead className="whitespace-nowrap text-right">电用量/电费</TableHead>
              <TableHead className="whitespace-nowrap text-right">合计</TableHead>
              <TableHead className="whitespace-nowrap">状态</TableHead>
              {showActionColumn && <TableHead className="whitespace-nowrap text-right">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={showActionColumn ? 6 : 5} className="h-24 text-center text-muted-foreground">
                  {communityId || building || status !== 'all'
                    ? '当前筛选条件下没有收费记录'
                    : readOnly
                      ? '本期暂无收费记录'
                      : '本期暂无收费记录，点击右上角「抄表录入」开始'}
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const owner = ownerName(r.ownerId);
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">
                    <span className="block max-w-[160px] truncate font-medium">
                      {owner?.name ?? '业主已删除'}
                    </span>
                    <span className="block max-w-[200px] truncate text-xs text-muted-foreground">
                      {owner?.roomNo}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {r.waterUsage} 吨
                    <span className="block text-xs text-muted-foreground">
                      {formatMoney(r.waterAmount)} 元
                    </span>
                    {(r.waterLoss ?? 0) > 0 && (
                      <span className="block text-xs text-muted-foreground">损耗 {r.waterLoss}</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {r.electricUsage} 度
                    <span className="block text-xs text-muted-foreground">
                      {formatMoney(r.electricAmount)} 元
                    </span>
                    <span className="block text-xs text-muted-foreground">{r.electricTier}</span>
                    {(r.electricLoss ?? 0) > 0 && (
                      <span className="block text-xs text-muted-foreground">损耗 {r.electricLoss}</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                    {formatMoney(r.totalAmount)}
                    <span className="block text-xs font-normal text-muted-foreground">
                      物业 {formatMoney(r.propertyFee)} + 垃圾 {formatMoney(r.garbageFee)}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.paid ? (
                      <Badge>已缴</Badge>
                    ) : (
                      <Badge variant="outline">未缴</Badge>
                    )}
                  </TableCell>
                  {showActionColumn && (
                  <TableCell className="whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1">
                      {canPrint && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/print?readingId=${r.id}`)}
                          title="打印收据"
                        >
                          <Printer className="size-4" />
                        </Button>
                      )}
                      {!readOnly && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(r.id)}
                            title="编辑收费信息"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => togglePaid(r.id)}
                            title={r.paid ? '标记为未缴' : '标记为已缴'}
                          >
                            <Check className="size-4" />
                          </Button>
                          <AlertDialog
                            open={pendingDelete === r.id}
                            onOpenChange={(o) => setPendingDelete(o ? r.id : null)}
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                title="删除记录"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>删除收费记录？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  将删除 {owner?.name ?? ''}（{owner?.roomNo ?? ''}）本期收费记录，删除后不可恢复。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmDelete}>删除</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {!readOnly && (
        <>
          <ReadingDialog open={readingOpen} onOpenChange={setReadingOpen} />
          <EditReadingDialog key={editingId ?? 'closed'} readingId={editingId} onClose={() => setEditingId(null)} />
        </>
      )}
    </div>
  );
}
