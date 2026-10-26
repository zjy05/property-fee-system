import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { isAdmin } from '@/lib/permissions';
import { uid } from '@/lib/fee';
import { fullRoomNo, joinRoomNo, splitRoomNo } from '@/lib/owner';
import type { IOwner } from '@/data/types';
import OwnerDialog from './OwnerDialog';

const TEMPLATE_HEADERS = [
  '姓名',
  '小区',
  '楼栋',
  '单元',
  '房号',
  '联系电话',
  '水表号',
  '电表号',
  '物业费(元/月)',
];

export default function OwnersTab() {
  const { owners, readings, settings, setOwners, setReadings } = useAppStore();
  const readOnly = !isAdmin(getCurrentUser());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IOwner | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // 下载批量导入模板（带一行示例）
  const downloadTemplate = () => {
    const communityName = settings.communities[0]?.name ?? '';
    const example = ['张三', communityName, '中楼', '东单元', '6楼东户', '13800000000', 'S0001', 'D0001', 50];
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, example]);
    ws['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '业主档案');
    XLSX.writeFile(wb, '业主导入模板.xlsx');
    toast.success('模板已下载，填好后点「批量导入」上传');
  };

  // 上传填好的 Excel 批量导入
  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      if (rows.length === 0) {
        toast.error('文件里没有数据行');
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const existing = new Set(owners.map((o) => `${o.name}|${fullRoomNo(o)}`));
      const added: IOwner[] = [];
      let skipped = 0;
      let missing = 0;
      for (const row of rows) {
        const name = String(row['姓名'] ?? '').trim();
        let building = String(row['楼栋'] ?? '').trim();
        let unit = String(row['单元'] ?? '').trim();
        let room = String(row['房号'] ?? '').trim();
        // 兼容旧模板：只有一整串「房号」
        if (!unit && /[东西南北]单元/.test(room)) {
          const parts = splitRoomNo(room, building);
          building = building || parts.building;
          unit = parts.unit;
          room = parts.room;
        }
        const roomNo = joinRoomNo(building, unit, room);
        if (!name || !roomNo) {
          missing++;
          continue;
        }
        if (existing.has(`${name}|${roomNo}`)) {
          skipped++;
          continue;
        }
        const communityName = String(row['小区'] ?? '').trim();
        const community =
          settings.communities.find((c) => c.name === communityName) ??
          settings.communities[0];
        const propertyFeeRaw = Number(row['物业费(元/月)'] ?? 0);
        added.push({
          id: uid(),
          name,
          roomNo,
          communityId: community?.id ?? '',
          building,
          unit,
          room,
          phone: String(row['联系电话'] ?? '').trim(),
          waterMeterNo: String(row['水表号'] ?? '').trim(),
          electricMeterNo: String(row['电表号'] ?? '').trim(),
          propertyFee: Number.isFinite(propertyFeeRaw) && propertyFeeRaw >= 0 ? propertyFeeRaw : 0,
          createdAt: today,
        });
        existing.add(`${name}|${roomNo}`);
      }
      if (added.length > 0) {
        setOwners((prev) => [...prev, ...added]);
      }
      toast.success(
        `导入完成：新增 ${added.length} 位${skipped ? `，跳过重复 ${skipped}` : ''}${missing ? `，缺姓名/房号 ${missing} 行` : ''}`,
      );
    } catch {
      toast.error('导入失败，请确认是按模板填的 Excel 文件');
    }
  };

  const recordCount = (ownerId: string) => readings.filter((r) => r.ownerId === ownerId).length;
  const communityName = (id: string) =>
    settings.communities.find((c) => c.id === id)?.name ?? '未分小区';

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (owner: IOwner) => {
    setEditing(owner);
    setDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const count = recordCount(pendingDelete);
    setOwners((prev) => prev.filter((o) => o.id !== pendingDelete));
    if (count > 0) {
      setReadings((prev) => prev.filter((r) => r.ownerId !== pendingDelete));
      toast.success(`已删除业主及其 ${count} 条收费记录`);
    } else {
      toast.success('业主档案已删除');
    }
    setPendingDelete(null);
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {owners.length} 位业主</p>
        {!readOnly && (
          <div className="flex gap-2">
            <input
              ref={importRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImport}
            />
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="size-4" />
              下载模板
            </Button>
            <Button variant="outline" onClick={() => importRef.current?.click()}>
              <Upload className="size-4" />
              批量导入
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              新增业主
            </Button>
          </div>
        )}
      </div>

      <div className="w-full overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">姓名</TableHead>
              <TableHead className="whitespace-nowrap">楼栋 / 单元 / 房号</TableHead>
              <TableHead className="whitespace-nowrap">联系电话</TableHead>
              <TableHead className="whitespace-nowrap">水表号</TableHead>
              <TableHead className="whitespace-nowrap">电表号</TableHead>
              <TableHead className="whitespace-nowrap text-right">物业费(元/月)</TableHead>
              <TableHead className="whitespace-nowrap text-right">记录数</TableHead>
              <TableHead className="whitespace-nowrap text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {owners.length === 0 && (
              <TableRow>
                <TableCell colSpan={readOnly ? 7 : 8} className="h-24 text-center text-muted-foreground">
                  {readOnly ? '暂无业主档案' : '暂无业主档案，点击右上角「新增业主」添加'}
                </TableCell>
              </TableRow>
            )}
            {owners.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="whitespace-nowrap">
                  <span className="block max-w-[120px] truncate font-medium">{o.name}</span>
                  <span className="block max-w-[140px] truncate text-xs text-muted-foreground">
                    {communityName(o.communityId)}
                    {o.building ? ` · ${o.building}` : ''}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="block max-w-[220px] truncate">
                    {[o.building, o.unit, o.room].filter(Boolean).join(' / ') || o.roomNo}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="block max-w-[150px] truncate">{o.phone || '—'}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="block max-w-[130px] truncate">{o.waterMeterNo || '—'}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="block max-w-[130px] truncate">{o.electricMeterNo || '—'}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">
                  {o.propertyFee}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">
                  {recordCount(o.id)}
                </TableCell>
                {!readOnly && (
                  <TableCell className="whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(o)}
                        title="编辑业主"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <AlertDialog
                        open={pendingDelete === o.id}
                        onOpenChange={(op) => setPendingDelete(op ? o.id : null)}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            title="删除业主"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>删除业主档案？</AlertDialogTitle>
                            <AlertDialogDescription>
                              {recordCount(o.id) > 0
                                ? `该业主存在 ${recordCount(o.id)} 条收费记录，删除后将一并删除其全部记录，且不可恢复。`
                                : '删除后不可恢复。'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete}>删除</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!readOnly && (
        <OwnerDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={editing} />
      )}
    </div>
  );
}
