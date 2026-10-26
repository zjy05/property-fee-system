import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/lib/store-context';
import { uid } from '@/lib/fee';
import { joinRoomNo, splitRoomNo } from '@/lib/owner';
import type { IOwner } from '@/data/types';

interface OwnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 编辑时传入业主，新增时为 null */
  initial: IOwner | null;
}

export default function OwnerDialog({ open, onOpenChange, initial }: OwnerDialogProps) {
  const { owners, settings, setOwners } = useAppStore();
  const communities = settings.communities;
  const [name, setName] = useState(initial?.name ?? '');
  const [communityId, setCommunityId] = useState(initial?.communityId ?? '');
  const [building, setBuilding] = useState(initial?.building ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [room, setRoom] = useState(initial?.room ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [waterMeterNo, setWaterMeterNo] = useState(initial?.waterMeterNo ?? '');
  const [electricMeterNo, setElectricMeterNo] = useState(initial?.electricMeterNo ?? '');
  const [propertyFee, setPropertyFee] = useState(String(initial?.propertyFee ?? 0));

  const buildingOptions =
    communityId && communityId !== '__all'
      ? (communities.find((c) => c.id === communityId)?.buildings ?? [])
      : [];

  const fullRoomNo = joinRoomNo(building, unit, room);

  // 打开时同步编辑对象（组件复用，避免切换编辑对象时残留旧值）
  const syncFromInitial = (o: IOwner | null) => {
    const parts = splitRoomNo(o?.roomNo ?? '', o?.building ?? '');
    setName(o?.name ?? '');
    setCommunityId(o?.communityId ?? communities[0]?.id ?? '');
    setBuilding(o?.building || parts.building);
    setUnit(o?.unit || parts.unit);
    setRoom(o?.room || parts.room);
    setPhone(o?.phone ?? '');
    setWaterMeterNo(o?.waterMeterNo ?? '');
    setElectricMeterNo(o?.electricMeterNo ?? '');
    setPropertyFee(String(o?.propertyFee ?? 0));
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('请填写业主姓名');
      return;
    }
    if (!communityId) {
      toast.error('请选择所属小区（可先在设置-小区管理中添加）');
      return;
    }
    if (!building.trim()) {
      toast.error('请选择或填写所属楼栋');
      return;
    }
    if (!room.trim()) {
      toast.error('请填写房号，如 6楼东户');
      return;
    }
    const pf = Number(propertyFee);
    if (!Number.isFinite(pf) || pf < 0) {
      toast.error('物业费必须为非负数字');
      return;
    }
    const data = {
      name: name.trim(),
      roomNo: fullRoomNo,
      communityId,
      building: building.trim(),
      unit: unit.trim(),
      room: room.trim(),
      phone: phone.trim(),
      waterMeterNo: waterMeterNo.trim(),
      electricMeterNo: electricMeterNo.trim(),
      propertyFee: pf,
    };
    if (initial) {
      setOwners((prev) =>
        prev.map((o) => (o.id === initial.id ? { ...o, ...data } : o)),
      );
      toast.success('业主信息已更新');
    } else {
      const duplicate = owners.some(
        (o) => joinRoomNo(o.building, o.unit ?? '', o.room ?? '') === fullRoomNo,
      );
      if (duplicate) {
        toast.error('该房号已存在业主档案');
        return;
      }
      const owner: IOwner = {
        id: uid(),
        ...data,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setOwners((prev) => [...prev, owner]);
      toast.success('业主档案已新增');
    }
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) syncFromInitial(initial);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? '编辑业主' : '新增业主'}</DialogTitle>
          <DialogDescription>
            楼栋 / 单元 / 房号分开填写；完整房号会自动拼成「中楼东单元6楼东户」。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid min-w-0 gap-1.5">
              <Label>姓名</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="业主姓名" />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label>所属小区</Label>
              <Select
                value={communityId}
                onValueChange={(v) => {
                  setCommunityId(v);
                  setBuilding('');
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择小区" />
                </SelectTrigger>
                <SelectContent>
                  {communities.length === 0 && <SelectItem value="__none">暂无小区，请先在数据-小区信息中添加</SelectItem>}
                  {communities.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid min-w-0 gap-1.5">
              <Label>楼栋</Label>
              {buildingOptions.length > 0 ? (
                <Select value={building} onValueChange={setBuilding}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择楼栋" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildingOptions.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="如 中楼" />
              )}
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label>单元</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="如 东单元" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid min-w-0 gap-1.5">
              <Label>房号</Label>
              <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="如 6楼东户" />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label>完整房号</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                {fullRoomNo || '楼栋 + 单元 + 房号'}
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>联系电话</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="选填" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid min-w-0 gap-1.5">
              <Label>水表号</Label>
              <Input
                value={waterMeterNo}
                onChange={(e) => setWaterMeterNo(e.target.value)}
                placeholder="选填"
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label>电表号</Label>
              <Input
                value={electricMeterNo}
                onChange={(e) => setElectricMeterNo(e.target.value)}
                placeholder="选填"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>物业费（元/月）</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={propertyFee}
              onChange={(e) => setPropertyFee(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" onClick={handleSubmit}>
            {initial ? '保存修改' : '新增业主'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
