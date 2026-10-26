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
import { useAppStore } from '@/lib/store-context';
import { calcFee, electricTierOf, formatMoney, toCNNumber } from '@/lib/fee';

interface EditReadingDialogProps {
  readingId: string | null;
  onClose: () => void;
}

/** 台账操作列「编辑」：单独编辑某户本期收费信息，保存后实时重算费用，可反复修改。
 *  父组件以 key={readingId} 挂载，打开时自动载入该记录当前值。 */
export default function EditReadingDialog({ readingId, onClose }: EditReadingDialogProps) {
  const { readings, owners, settings, setReadings } = useAppStore();
  const reading = readings.find((r) => r.id === readingId);

  const [waterPrev, setWaterPrev] = useState(reading ? String(reading.waterPrev) : '');
  const [waterCurr, setWaterCurr] = useState(reading ? String(reading.waterCurr) : '');
  const [electricPrev, setElectricPrev] = useState(reading ? String(reading.electricPrev) : '');
  const [electricCurr, setElectricCurr] = useState(reading ? String(reading.electricCurr) : '');
  const [propertyFee, setPropertyFee] = useState(reading ? String(reading.propertyFee) : '');
  const [garbageFee, setGarbageFee] = useState(reading ? String(reading.garbageFee) : '');
  const [paid, setPaid] = useState(reading?.paid ?? false);
  // v1.3.0
  const [waterLoss, setWaterLoss] = useState(reading?.waterLoss ? String(reading.waterLoss) : '');
  const [electricLoss, setElectricLoss] = useState(reading?.electricLoss ? String(reading.electricLoss) : '');
  const [customName, setCustomName] = useState(reading?.customName || '');
  const [customPrev, setCustomPrev] = useState(reading?.customPrev ? String(reading.customPrev) : '');
  const [customCurr, setCustomCurr] = useState(reading?.customCurr ? String(reading.customCurr) : '');
  const [customLoss, setCustomLoss] = useState(reading?.customLoss ? String(reading.customLoss) : '');
  const [customPrice, setCustomPrice] = useState(reading?.customPrice ? String(reading.customPrice) : '');
  const [item1Name, setItem1Name] = useState(reading?.item1Name || '');
  const [item1Amount, setItem1Amount] = useState(reading?.item1Amount ? String(reading.item1Amount) : '');
  const [item1Note, setItem1Note] = useState(reading?.item1Note || '');
  const [item2Name, setItem2Name] = useState(reading?.item2Name || '');
  const [item2Amount, setItem2Amount] = useState(reading?.item2Amount ? String(reading.item2Amount) : '');
  const [item2Note, setItem2Note] = useState(reading?.item2Note || '');
  const [item3Name, setItem3Name] = useState(reading?.item3Name || '');
  const [item3Amount, setItem3Amount] = useState(reading?.item3Amount ? String(reading.item3Amount) : '');
  const [item3Note, setItem3Note] = useState(reading?.item3Note || '');
  const [lastBalance, setLastBalance] = useState(reading?.lastBalance ? String(reading.lastBalance) : '');
  const [paidAmountInput, setPaidAmountInput] = useState(
    reading?.paidAmount ? String(reading.paidAmount) : '',
  );
  const [receiver, setReceiver] = useState(reading?.receiver || '');
  const [reader, setReader] = useState(reading?.reader || '');
  const [note, setNote] = useState(reading?.note || '');

  const owner = reading ? owners.find((o) => o.id === reading.ownerId) : undefined;
  const community = owner
    ? settings.communities.find((c) => c.id === owner.communityId)
    : undefined;
  const waterPrice = community?.waterPrice ?? settings.waterPrice;
  const hasTier = community?.hasTier ?? true;

  const n = (s: string) => (s.trim() === '' ? 0 : Number(s));

  // 编辑时重算年度累计用电量：排除当前记录自身，避免重复计入
  const year = reading?.period.split('-')[0] ?? '';
  const existingYearUsage =
    !readingId || !year
      ? 0
      : readings
          .filter(
            (r) =>
              r.ownerId === reading?.ownerId &&
              r.period.startsWith(year) &&
              r.id !== readingId,
          )
          .reduce((sum, r) => sum + (r.electricUsage ?? 0), 0);

  const electricUsage = Math.max(0, n(electricCurr) - n(electricPrev));
  const yearUsage = existingYearUsage + electricUsage;
  const tier = hasTier
    ? electricTierOf(yearUsage, settings)
    : { tier: 1 as const, price: community?.electricPrice ?? settings.electricTier1Price, label: '' };

  // v1.3.0 损耗与自定义
  const waterLossRate = community?.waterLossRate ?? 0;
  const electricLossRate = community?.electricLossRate ?? 0;
  const autoWaterLoss = Math.round((n(waterCurr) - n(waterPrev)) * waterLossRate * 100) / 100;
  const autoElectricLoss = Math.round(electricUsage * electricLossRate * 100) / 100;
  const waterLossVal = waterLoss === '' ? autoWaterLoss : n(waterLoss);
  const electricLossVal = electricLoss === '' ? autoElectricLoss : n(electricLoss);
  const customLossVal = customLoss === '' ? 0 : n(customLoss);

  const fee = calcFee(
    n(waterPrev),
    n(waterCurr),
    n(electricPrev),
    n(electricCurr),
    yearUsage,
    settings,
    n(propertyFee),
    community,
    n(garbageFee),
    {
      waterLossRate,
      electricLossRate,
      waterLoss: waterLoss === '' ? undefined : waterLossVal,
      electricLoss: electricLoss === '' ? undefined : electricLossVal,
      customPrev: n(customPrev),
      customCurr: n(customCurr),
      customPrice: n(customPrice),
      customLoss: customLoss === '' ? undefined : customLossVal,
      item1Amount: n(item1Amount),
      item2Amount: n(item2Amount),
      item3Amount: n(item3Amount),
    },
  );

  const lastBalanceNum = n(lastBalance);
  const paidAmount = paid ? (paidAmountInput === '' ? fee.totalAmount : n(paidAmountInput)) : 0;
  const curBalance = Math.round((lastBalanceNum + fee.totalAmount - paidAmount) * 100) / 100;

  const save = () => {
    if (!reading) return;
    const nums = [waterPrev, waterCurr, electricPrev, electricCurr].map(n);
    if (nums.some((v) => !Number.isFinite(v) || v < 0)) {
      toast.error('读数必须为非负数字');
      return;
    }
    if (nums[1] < nums[0] || nums[3] < nums[2]) {
      toast.error('本月读数不能小于上月读数');
      return;
    }
    const pf = n(propertyFee);
    const gf = n(garbageFee);
    if (!Number.isFinite(pf) || pf < 0 || !Number.isFinite(gf) || gf < 0) {
      toast.error('物业费与垃圾处理费必须为非负数字');
      return;
    }
    setReadings((prev) =>
      prev.map((r) =>
        r.id === reading.id
          ? {
              ...r,
              waterPrev: nums[0],
              waterCurr: nums[1],
              electricPrev: nums[2],
              electricCurr: nums[3],
              waterUsage: fee.waterUsage,
              electricUsage: fee.electricUsage,
              yearElectricUsage: yearUsage,
              electricTier: fee.electricTier,
              waterAmount: fee.waterAmount,
              electricAmount: fee.electricAmount,
              lineAmount: fee.lineAmount,
              propertyFee: pf,
              garbageFee: gf,
              totalAmount: fee.totalAmount,
              paid,
              paidDate: paid
                ? r.paidDate ?? new Date().toISOString().slice(0, 10)
                : undefined,
              // v1.3.0
              waterLoss: fee.waterLoss,
              electricLoss: fee.electricLoss,
              customName: customName.trim(),
              customPrev: n(customPrev),
              customCurr: n(customCurr),
              customUsage: fee.customUsage,
              customLoss: fee.customLoss,
              customPrice: n(customPrice),
              customAmount: fee.customAmount,
              item1Name: item1Name.trim(),
              item1Amount: n(item1Amount),
              item1Note: item1Note.trim(),
              item2Name: item2Name.trim(),
              item2Amount: n(item2Amount),
              item2Note: item2Note.trim(),
              item3Name: item3Name.trim(),
              item3Amount: n(item3Amount),
              item3Note: item3Note.trim(),
              lastBalance: lastBalanceNum,
              curBalance,
              paidAmount,
              receiver: receiver.trim(),
              reader: reader.trim(),
              note: note.trim(),
            }
          : r,
      ),
    );
    toast.success('收费信息已更新');
    onClose();
  };

  if (!reading || !owner) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑收费信息</DialogTitle>
          <DialogDescription>
            {owner.name}（{owner.roomNo}）· {reading.period} 期，修改后按小区单价实时重算。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {/* 缴费状态 */}
          <div className="grid gap-1.5">
            <Label>缴费状态</Label>
            <div className="flex gap-1 rounded-md border bg-muted/40 p-1">
              <button
                type="button"
                className={`flex-1 rounded px-2 py-1 text-sm transition-colors ${
                  !paid ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'
                }`}
                onClick={() => setPaid(false)}
              >
                未缴
              </button>
              <button
                type="button"
                className={`flex-1 rounded px-2 py-1 text-sm transition-colors ${
                  paid ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'
                }`}
                onClick={() => setPaid(true)}
              >
                已缴
              </button>
            </div>
          </div>

          {/* 物业费 + 垃圾处理费 */}
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
            <div className="grid min-w-0 gap-1.5">
              <Label>物业费（元）</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={propertyFee}
                onChange={(e) => setPropertyFee(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label>垃圾处理费（元）</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={garbageFee}
                onChange={(e) => setGarbageFee(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* 电表读数 + 损耗 */}
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              电表（年度累计 {yearUsage} 度 → {hasTier ? `${tier.label}，单价 ${tier.price} 元/度` : `固定电价 ${tier.price} 元/度`}）
            </p>
            <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-4">
              <div className="grid min-w-0 gap-1.5">
                <Label className="text-xs">上月读数</Label>
                <Input type="number" min={0} value={electricPrev} onChange={(e) => setElectricPrev(e.target.value)} placeholder="0" />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label className="text-xs">本月读数</Label>
                <Input type="number" min={0} value={electricCurr} onChange={(e) => setElectricCurr(e.target.value)} placeholder="0" />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label className="text-xs">损耗</Label>
                <Input type="number" min={0} value={electricLoss === '' ? String(autoElectricLoss) : electricLoss} onChange={(e) => setElectricLoss(e.target.value)} placeholder="0" />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label className="text-xs">金额</Label>
                <div className="flex h-9 items-center rounded-md border bg-background px-3 text-sm font-semibold tabular-nums">{formatMoney(fee.electricAmount)}</div>
              </div>
            </div>
          </div>

          {/* 水表读数 + 损耗 */}
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">水表（单价 {waterPrice} 元/吨）</p>
            <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-4">
              <div className="grid min-w-0 gap-1.5">
                <Label className="text-xs">上月读数</Label>
                <Input type="number" min={0} value={waterPrev} onChange={(e) => setWaterPrev(e.target.value)} placeholder="0" />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label className="text-xs">本月读数</Label>
                <Input type="number" min={0} value={waterCurr} onChange={(e) => setWaterCurr(e.target.value)} placeholder="0" />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label className="text-xs">损耗</Label>
                <Input type="number" min={0} value={waterLoss === '' ? String(autoWaterLoss) : waterLoss} onChange={(e) => setWaterLoss(e.target.value)} placeholder="0" />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label className="text-xs">金额</Label>
                <div className="flex h-9 items-center rounded-md border bg-background px-3 text-sm font-semibold tabular-nums">{formatMoney(fee.waterAmount)}</div>
              </div>
            </div>
          </div>

          {/* 自定义抄表行 */}
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="自定义抄表行名称（如 动力电）"
                className="h-8 w-48 text-xs"
              />
              <p className="text-xs text-muted-foreground">抄表行</p>
            </div>
            <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-4">
              <div className="grid min-w-0 gap-1.5">
                <Label className="text-xs">上月读数</Label>
                <Input type="number" min={0} value={customPrev} onChange={(e) => setCustomPrev(e.target.value)} placeholder="0" />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label className="text-xs">本月读数</Label>
                <Input type="number" min={0} value={customCurr} onChange={(e) => setCustomCurr(e.target.value)} placeholder="0" />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label className="text-xs">单价</Label>
                <Input type="number" min={0} value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="0" />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label className="text-xs">金额</Label>
                <div className="flex h-9 items-center rounded-md border bg-background px-3 text-sm font-semibold tabular-nums">{formatMoney(fee.customAmount)}</div>
              </div>
            </div>
          </div>

          {/* 自定义款项 1-3 */}
          <div className="grid gap-3 rounded-md border bg-muted/40 p-3 min-[560px]:grid-cols-3">
            {[
              { name: item1Name, setName: setItem1Name, amount: item1Amount, setAmount: setItem1Amount, note: item1Note, setNote: setItem1Note },
              { name: item2Name, setName: setItem2Name, amount: item2Amount, setAmount: setItem2Amount, note: item2Note, setNote: setItem2Note },
              { name: item3Name, setName: setItem3Name, amount: item3Amount, setAmount: setItem3Amount, note: item3Note, setNote: setItem3Note },
            ].map((it, i) => (
              <div key={i} className="grid gap-1.5">
                <Label className="text-[11px] text-muted-foreground">自定义款项 {i + 1}</Label>
                <Input value={it.name} onChange={(e) => it.setName(e.target.value)} placeholder="内容" className="h-8 text-xs" />
                <Input type="number" min={0} step={0.01} value={it.amount} onChange={(e) => it.setAmount(e.target.value)} placeholder="金额（元）" className="h-8 text-xs" />
                <Input value={it.note} onChange={(e) => it.setNote(e.target.value)} placeholder="备注" className="h-8 text-xs" />
              </div>
            ))}
          </div>

          {/* 结余与实收 */}
          <div className="grid gap-3 rounded-md border bg-card px-4 py-3 min-[560px]:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-[11px] text-muted-foreground">上次结余（元）</Label>
              <Input type="number" value={lastBalance} onChange={(e) => setLastBalance(e.target.value)} placeholder="0" className="h-9 text-sm" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[11px] text-muted-foreground">应收（元）</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/60 px-3 text-sm font-semibold tabular-nums">{formatMoney(fee.totalAmount)}</div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[11px] text-muted-foreground">本次结余（元）</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/60 px-3 text-sm font-semibold tabular-nums">{formatMoney(curBalance)}</div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[11px] text-muted-foreground">实收（元）{paid ? '（已缴）' : '（未缴）'}</Label>
              <Input type="number" min={0} step={0.01} value={paidAmountInput} onChange={(e) => setPaidAmountInput(e.target.value)} placeholder={paid ? String(fee.totalAmount) : '0'} className="h-9 text-sm" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[11px] text-muted-foreground">实收大写</Label>
              <div className="flex h-9 items-center truncate rounded-md border bg-muted/60 px-3 text-xs tabular-nums">
                {paidAmount > 0 ? toCNNumber(paidAmount) : '零'}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[11px] text-muted-foreground">收费人 / 抄表人</Label>
              <div className="flex gap-2">
                <Input value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder="收费人" className="h-9 text-sm" />
                <Input value={reader} onChange={(e) => setReader(e.target.value)} placeholder="抄表人" className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid gap-1.5 min-[560px]:col-span-3">
              <Label className="text-[11px] text-muted-foreground">备注</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注（可选）" className="h-9 text-sm" />
            </div>
          </div>

          {/* 费用预览 */}
          <div className="rounded-md border bg-card px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                电费（{fee.electricUsage} 度 × {tier.price} 元{hasTier ? '' : '，固定电价'}）
              </span>
              <span className="font-semibold tabular-nums">{formatMoney(fee.electricAmount)} 元</span>
            </div>
            {fee.lineAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  线路维护费（{fee.electricUsage} 度 × {community?.lineFee ?? 0} 元）
                </span>
                <span className="font-semibold tabular-nums">{formatMoney(fee.lineAmount)} 元</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">水费（{fee.waterUsage} 吨 × {waterPrice} 元）</span>
              <span className="font-semibold tabular-nums">{formatMoney(fee.waterAmount)} 元</span>
            </div>
            {fee.customAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{(customName || '自定义')}（{fee.customUsage} × {n(customPrice)} 元）</span>
                <span className="font-semibold tabular-nums">{formatMoney(fee.customAmount)} 元</span>
              </div>
            )}
            {fee.itemsTotal > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">自定义款项合计</span>
                <span className="font-semibold tabular-nums">{formatMoney(fee.itemsTotal)} 元</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">物业费 + 垃圾处理费</span>
              <span className="font-semibold tabular-nums">
                {formatMoney(n(propertyFee) + n(garbageFee))} 元
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2">
              <span className="font-medium">本期应收</span>
              <span className="text-base font-bold tabular-nums text-primary">
                {formatMoney(fee.totalAmount)} 元
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="button" onClick={save}>
            保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
