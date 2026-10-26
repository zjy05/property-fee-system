import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import Tesseract from 'tesseract.js';
import { toast } from 'sonner';
import { Camera, Check, ChevronsUpDown } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useAppStore } from '@/lib/store-context';
import { calcFee, currentPeriod, electricTierOf, formatMoney, toCNNumber, uid } from '@/lib/fee';
import { cn } from '@/lib/utils';
import type { IOwner, IReading } from '@/data/types';

interface ReadingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FieldKey =
  | 'period'
  | 'fee'
  | 'garbage'
  | 'waterPrev'
  | 'waterCurr'
  | 'elePrev'
  | 'eleCurr'
  | 'customPrev'
  | 'customCurr'
  | 'customName'
  | 'item1Amount'
  | 'item2Amount'
  | 'item3Amount'
  | 'receiver'
  | 'reader';

export default function ReadingDialog({ open, onOpenChange }: ReadingDialogProps) {
  const { owners, readings, settings, setReadings } = useAppStore();

  const [ownerId, setOwnerId] = useState('');
  const [period, setPeriod] = useState(currentPeriod());
  const [filterCommunity, setFilterCommunity] = useState('__all');
  const [waterPrev, setWaterPrev] = useState('');
  const [waterCurr, setWaterCurr] = useState('');
  const [electricPrev, setElectricPrev] = useState('');
  const [electricCurr, setElectricCurr] = useState('');
  const [propertyFee, setPropertyFee] = useState('0');
  const [garbageFeeInput, setGarbageFeeInput] = useState('5');
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ocrBusy, setOcrBusy] = useState<FieldKey | null>(null);

  // v1.3.0 损耗 / 自定义抄表行 / 自定义款项 / 结余 / 实收
  const [waterLoss, setWaterLoss] = useState('');
  const [electricLoss, setElectricLoss] = useState('');
  const [customName, setCustomName] = useState('自定义');
  const [customPrev, setCustomPrev] = useState('');
  const [customCurr, setCustomCurr] = useState('');
  const [customLoss, setCustomLoss] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [item1Name, setItem1Name] = useState('');
  const [item1Amount, setItem1Amount] = useState('');
  const [item1Note, setItem1Note] = useState('');
  const [item2Name, setItem2Name] = useState('');
  const [item2Amount, setItem2Amount] = useState('');
  const [item2Note, setItem2Note] = useState('');
  const [item3Name, setItem3Name] = useState('');
  const [item3Amount, setItem3Amount] = useState('');
  const [item3Note, setItem3Note] = useState('');
  const [lastBalance, setLastBalance] = useState('');
  const [paid, setPaid] = useState(false);
  const [receiver, setReceiver] = useState('');
  const [reader, setReader] = useState('');
  const [note, setNote] = useState('');

  const periodRef = useRef<HTMLInputElement>(null);
  const feeRef = useRef<HTMLInputElement>(null);
  const garbageRef = useRef<HTMLInputElement>(null);
  const elePrevRef = useRef<HTMLInputElement>(null);
  const eleCurrRef = useRef<HTMLInputElement>(null);
  const waterPrevRef = useRef<HTMLInputElement>(null);
  const waterCurrRef = useRef<HTMLInputElement>(null);
  const customPrevRef = useRef<HTMLInputElement>(null);
  const customCurrRef = useRef<HTMLInputElement>(null);
  const customNameRef = useRef<HTMLInputElement>(null);
  const item1Ref = useRef<HTMLInputElement>(null);
  const item2Ref = useRef<HTMLInputElement>(null);
  const item3Ref = useRef<HTMLInputElement>(null);
  const receiverRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedOwner = owners.find((o) => o.id === ownerId);
  const selectedOwnerLabel = selectedOwner
    ? `${selectedOwner.name} · ${selectedOwner.roomNo}`
    : '选择业主';

  // 收费参数按业主所属小区配置（水价、垃圾处理费、损耗率、自定义行名称），缺省用全局默认
  const community = selectedOwner
    ? settings.communities.find((c) => c.id === selectedOwner.communityId)
    : undefined;
  const waterPrice = community?.waterPrice ?? settings.waterPrice;
  const customMeterName = community?.customMeterName || '自定义';

  const n = (s: string) => (s.trim() === '' ? 0 : Number(s));

  // 业主按所选小区过滤（下拉内可继续搜索姓名/房号）
  const filteredOwners = useMemo(() => {
    const list =
      filterCommunity === '__all'
        ? owners
        : owners.filter((o) => o.communityId === filterCommunity);
    return [...list].sort((a, b) =>
      a.roomNo.localeCompare(b.roomNo, 'zh-CN', { numeric: true }),
    );
  }, [owners, filterCommunity]);

  // 把上一期的本月读数带入上月读数 + 带出上次结余/自定义行名称
  const fillLastReading = (ownerIdParam: string, periodParam: string) => {
    if (!ownerIdParam || !/^\d{4}-\d{2}$/.test(periodParam)) return;
    const last = readings
      .filter((r) => r.ownerId === ownerIdParam && r.period < periodParam)
      .sort((a, b) => b.period.localeCompare(a.period))[0];
    if (last) {
      setWaterPrev(String(last.waterCurr ?? ''));
      setElectricPrev(String(last.electricCurr ?? ''));
      setCustomPrev(String(last.customCurr ?? ''));
      setLastBalance(String(last.curBalance ?? 0));
      if (last.customName) setCustomName(last.customName);
    }
  };

  // 回车焦点流：期次→物业费→垃圾费→水上月→水本月→电上月→电本月→自定义行名→自定义上月→自定义本月→款项1金额→款项2金额→款项3金额→收费人→抄表人→（保存并录下一户）
  const enter = (field: string) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'period') feeRef.current?.focus();
      else if (field === 'fee') garbageRef.current?.focus();
      else if (field === 'garbage') waterPrevRef.current?.focus();
      else if (field === 'waterPrev') waterCurrRef.current?.focus();
      else if (field === 'waterCurr') elePrevRef.current?.focus();
      else if (field === 'elePrev') eleCurrRef.current?.focus();
      else if (field === 'eleCurr') customNameRef.current?.focus();
      else if (field === 'customName') customPrevRef.current?.focus();
      else if (field === 'customPrev') customCurrRef.current?.focus();
      else if (field === 'customCurr') item1Ref.current?.focus();
      else if (field === 'item1Amount') item2Ref.current?.focus();
      else if (field === 'item2Amount') item3Ref.current?.focus();
      else if (field === 'item3Amount') receiverRef.current?.focus();
      else if (field === 'receiver') readerRef.current?.focus();
      else handleSubmit(true);
    }
  };

  // 年度累计用电量（同户同年已录记录 + 本月），用于判断阶梯
  const year = period.split('-')[0];
  const existingYearUsage = useMemo(() => {
    if (!ownerId || !/^\d{4}-\d{2}$/.test(period)) return 0;
    return readings
      .filter((r) => r.ownerId === ownerId && r.period.startsWith(year) && r.period !== period)
      .reduce((sum, r) => sum + (r.electricUsage ?? 0), 0);
  }, [readings, ownerId, period, year]);

  const electricUsage = Math.max(0, n(electricCurr) - n(electricPrev));
  const yearUsage = existingYearUsage + electricUsage;
  // 电价展示：小区启用阶梯 -> 按全局阶梯；否则按小区固定电价
  const hasTier = community?.hasTier ?? true;
  const tier = hasTier
    ? electricTierOf(yearUsage, settings)
    : { tier: 1 as const, price: community?.electricPrice ?? settings.electricTier1Price, label: '' };

  // v1.3.0 损耗率（小数）与手改损耗
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
    n(garbageFeeInput),
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
  const paidAmount = paid ? fee.totalAmount : 0;
  const curBalance = Math.round((lastBalanceNum + fee.totalAmount - paidAmount) * 100) / 100;

  const selectOwner = (id: string) => {
    setOwnerId(id);
    const owner = owners.find((o) => o.id === id);
    setPropertyFee(String(owner?.propertyFee ?? 0));
    const ownCommunity = settings.communities.find(
      (c) => c.id === owner?.communityId,
    );
    setGarbageFeeInput(
      String(ownCommunity?.garbageFee ?? settings.garbageFee),
    );
    setCustomName(ownCommunity?.customMeterName || '自定义');
    setCustomPrice('');
    setCustomCurr('');
    setWaterLoss('');
    setElectricLoss('');
    setCustomLoss('');
    setOwnerOpen(false);
    fillLastReading(id, period);
  };

  const reset = () => {
    setOwnerId('');
    setPeriod(currentPeriod());
    setWaterPrev('');
    setWaterCurr('');
    setElectricPrev('');
    setElectricCurr('');
    setPropertyFee('0');
    setGarbageFeeInput(String(settings.garbageFee));
    setWaterLoss('');
    setElectricLoss('');
    setCustomName('自定义');
    setCustomPrev('');
    setCustomCurr('');
    setCustomLoss('');
    setCustomPrice('');
    setItem1Name('');
    setItem1Amount('');
    setItem1Note('');
    setItem2Name('');
    setItem2Amount('');
    setItem2Note('');
    setItem3Name('');
    setItem3Amount('');
    setItem3Note('');
    setLastBalance('');
    setPaid(false);
    setReceiver('');
    setReader('');
    setNote('');
  };

  // 保存后下一位待录入业主（按房号排序取当前户之后的第一个未录户；本期全部录完返回 null）
  const nextOwnerAfter = (currentId: string): IOwner | null => {
    const sorted = [...filteredOwners].sort((a, b) =>
      a.roomNo.localeCompare(b.roomNo, 'zh-CN', { numeric: true }),
    );
    const done = new Set(readings.filter((r) => r.period === period).map((r) => r.ownerId));
    done.add(currentId);
    const pending = sorted.filter((o) => !done.has(o.id));
    if (pending.length === 0) return null;
    const idx = sorted.findIndex((o) => o.id === currentId);
    return pending.find((o) => sorted.findIndex((x) => x.id === o.id) > idx) ?? pending[0];
  };

  // 拍照/上传整张抄表单识别读数（Tesseract.js 纯本地开源 OCR）：按顺序填入 电上月/电本月/水上月/水本月
  const triggerOcr = () => {
    fileRef.current?.click();
  };

  const handleOcrFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setOcrBusy('elePrev');
    try {
      const { data } = await Tesseract.recognize(file, 'eng');
      // 从识别文本里提取所有数字串（含小数），按出现顺序填入读数框
      const nums = (data.text ?? '')
        .match(/\d{1,6}(?:\.\d{1,2})?/g)
        ?.filter((v) => Number(v) > 0) ?? [];
      if (nums.length === 0) {
        toast.error('未识别到数字，请手动输入');
        return;
      }
      const [ep, ec, wp, wc] = nums;
      if (ep) setElectricPrev(ep);
      if (ec) setElectricCurr(ec);
      if (wp) setWaterPrev(wp);
      if (wc) setWaterCurr(wc);
      toast.success(
        `识别到 ${nums.length} 个数字，已按顺序填入，如不准可直接修改`,
      );
    } catch {
      toast.error('识别失败，请手动输入');
    } finally {
      setOcrBusy(null);
    }
  };

  const handleSubmit = (continueNext: boolean) => {
    const currentOwnerName = owners.find((o) => o.id === ownerId)?.name ?? '';
    if (!ownerId) {
      toast.error('请选择业主');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(period)) {
      toast.error('期次格式应为 2026-09');
      return;
    }
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
    if (!Number.isFinite(pf) || pf < 0) {
      toast.error('物业费必须为非负数字');
      return;
    }
    const exists = readings.some((r) => r.ownerId === ownerId && r.period === period);
    if (exists) {
      toast.error('该业主本期已录入，请勿重复录入');
      return;
    }

    const count = readings.filter((r) => r.period === period).length;
    const now = new Date().toISOString().slice(0, 10);
    const reading: IReading = {
      id: uid(),
      ownerId,
      period,
      receiptNo: `${settings.receiptNoPrefix}${period.replace('-', '')}${String(
        settings.receiptNoStart + count,
      ).padStart(4, '0')}`,
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
      garbageFee: n(garbageFeeInput),
      totalAmount: fee.totalAmount,
      paid,
      paidAmount,
      receiver: receiver.trim(),
      reader: reader.trim(),
      note: note.trim(),
      // v1.3.0
      waterLoss: fee.waterLoss,
      electricLoss: fee.electricLoss,
      customName: customName.trim() || '自定义',
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
      createdAt: now,
    };
    setReadings((prev) => [...prev, reading]);
    if (continueNext) {
      const next = nextOwnerAfter(ownerId);
      if (next) {
        selectOwner(next.id);
        toast.success(`已录入 ${currentOwnerName}，继续录下一户：${next.name}`);
        return;
      }
      toast.success(`已录入 ${currentOwnerName}，本期全部业主已录完`);
      reset();
      onOpenChange(false);
      return;
    }
    toast.success('抄表记录已录入');
    reset();
    onOpenChange(false);
  };

  // 抄表行单元格（上次/本次/损耗/单价输入）
  const MeterCell = ({
    label,
    value,
    onChange,
    onKeyDown,
    refObj,
    readOnly,
    className,
  }: {
    label: string;
    value: string;
    onChange?: (v: string) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
    refObj?: React.RefObject<HTMLInputElement | null>;
    readOnly?: boolean;
    className?: string;
  }) => (
    <div className="grid min-w-0 gap-1">
      <Label className="text-[11px] leading-none text-muted-foreground">{label}</Label>
      <Input
        ref={refObj}
        type="number"
        min={0}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="0"
        className={cn('h-9 text-sm', readOnly && 'bg-muted/60', className)}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleOcrFile} />
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>抄表录入</DialogTitle>
          <DialogDescription>
            每月只需录本月读数（上月读数自动带出）。回车依次跳到下一项，录完抄表人回车自动保存并录下一户；可点相机拍照识别读数。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {/* 第一行：小区过滤 + 业主选择 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid min-w-0 gap-1.5">
              <Label>小区过滤</Label>
              <Select value={filterCommunity} onValueChange={setFilterCommunity}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">全部小区</SelectItem>
                  {settings.communities.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label>业主</Label>
              <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={ownerOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">{selectedOwnerLabel}</span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0">
                  <Command>
                    <CommandInput placeholder="搜索姓名 / 房号..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>未找到业主</CommandEmpty>
                      <CommandGroup>
                        {filteredOwners.map((o) => (
                          <CommandItem
                            key={o.id}
                            value={`${o.name} ${o.roomNo}`}
                            onSelect={() => selectOwner(o.id)}
                          >
                            <Check
                              className={cn(
                                'size-4 shrink-0',
                                ownerId === o.id ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            <span className="truncate">
                              {o.name} · {o.roomNo}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* 拍照识别整张抄表单 */}
          <Button
            type="button"
            variant="outline"
            disabled={ocrBusy !== null}
            onClick={triggerOcr}
            className="w-full justify-center gap-2 border-dashed"
          >
            <Camera className={cn('size-4', ocrBusy && 'animate-pulse')} />
            {ocrBusy
              ? '正在识别…'
              : '拍照识别整张抄表单（电/水读数一次填入，人工核对）'}
          </Button>

          {/* 第二行：期次 + 物业费 + 垃圾处理费 */}
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-3">
            <div className="grid min-w-0 gap-1.5">
              <Label>期次</Label>
              <Input
                ref={periodRef}
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  fillLastReading(ownerId, e.target.value);
                }}
                onKeyDown={enter('period')}
                placeholder="2026-09"
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label>物业费（元）</Label>
              <Input
                ref={feeRef}
                type="number"
                min={0}
                step={1}
                value={propertyFee}
                onChange={(e) => setPropertyFee(e.target.value)}
                onKeyDown={enter('fee')}
                placeholder="0"
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label>垃圾处理费（元）</Label>
              <Input
                ref={garbageRef}
                type="number"
                min={0}
                step={1}
                value={garbageFeeInput}
                onChange={(e) => setGarbageFeeInput(e.target.value)}
                onKeyDown={enter('garbage')}
                placeholder="0"
              />
            </div>
          </div>

          {/* v1.3.0 三行抄表：水表 / 电表 / 自定义行（易达结构：上次抄见|本次抄见|抄见数|损耗|合计|单价|金额） */}
          {/* 水表 */}
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">水表（单价 {waterPrice} 元/吨）</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
              <MeterCell label="上次抄见" value={waterPrev} onChange={setWaterPrev} onKeyDown={enter('waterPrev')} refObj={waterPrevRef} />
              <MeterCell label="本次抄见" value={waterCurr} onChange={setWaterCurr} onKeyDown={enter('waterCurr')} refObj={waterCurrRef} />
              <MeterCell label="抄见数" value={String(fee.waterUsage)} readOnly />
              <MeterCell label="损耗" value={waterLoss === '' ? String(autoWaterLoss) : waterLoss} onChange={setWaterLoss} />
              <MeterCell label="合计" value={String(Math.round((fee.waterUsage + fee.waterLoss) * 100) / 100)} readOnly />
              <MeterCell label="单价" value={String(waterPrice)} readOnly />
              <MeterCell label="金额" value={formatMoney(fee.waterAmount)} readOnly className="font-semibold" />
            </div>
          </div>

          {/* 电表 */}
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                电表（年度累计 {yearUsage} 度 → {hasTier ? `${tier.label}，单价 ${tier.price} 元/度` : `固定电价 ${tier.price} 元/度`}）
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
              <MeterCell label="上次抄见" value={electricPrev} onChange={setElectricPrev} onKeyDown={enter('elePrev')} refObj={elePrevRef} />
              <MeterCell label="本次抄见" value={electricCurr} onChange={setElectricCurr} onKeyDown={enter('eleCurr')} refObj={eleCurrRef} />
              <MeterCell label="抄见数" value={String(fee.electricUsage)} readOnly />
              <MeterCell label="损耗" value={electricLoss === '' ? String(autoElectricLoss) : electricLoss} onChange={setElectricLoss} />
              <MeterCell label="合计" value={String(Math.round((fee.electricUsage + fee.electricLoss) * 100) / 100)} readOnly />
              <MeterCell label="单价" value={String(tier.price)} readOnly />
              <MeterCell label="金额" value={formatMoney(fee.electricAmount)} readOnly className="font-semibold" />
            </div>
          </div>

          {/* 自定义抄表行（名称可编辑，默认取小区设置） */}
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Input
                ref={customNameRef}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={enter('customName')}
                placeholder={customMeterName}
                className="h-8 w-40 text-xs"
              />
              <p className="text-xs text-muted-foreground">抄表行（名称可改，如 动力电 / 二次供水）</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
              <MeterCell label="上次抄见" value={customPrev} onChange={setCustomPrev} onKeyDown={enter('customPrev')} refObj={customPrevRef} />
              <MeterCell label="本次抄见" value={customCurr} onChange={setCustomCurr} onKeyDown={enter('customCurr')} refObj={customCurrRef} />
              <MeterCell label="抄见数" value={String(fee.customUsage)} readOnly />
              <MeterCell label="损耗" value={customLoss === '' ? '0' : customLoss} onChange={setCustomLoss} />
              <MeterCell label="合计" value={String(Math.round((fee.customUsage + fee.customLoss) * 100) / 100)} readOnly />
              <MeterCell label="单价" value={customPrice} onChange={setCustomPrice} />
              <MeterCell label="金额" value={formatMoney(fee.customAmount)} readOnly className="font-semibold" />
            </div>
          </div>

          {/* v1.3.0 三个自定义款项（易达 kxnr/kxje：内容/金额/备注） */}
          <div className="grid gap-3 rounded-md border bg-muted/40 p-3 min-[640px]:grid-cols-3">
            {[
              { name: item1Name, setName: setItem1Name, amount: item1Amount, setAmount: setItem1Amount, note: item1Note, setNote: setItem1Note, ref: item1Ref },
              { name: item2Name, setName: setItem2Name, amount: item2Amount, setAmount: setItem2Amount, note: item2Note, setNote: setItem2Note, ref: item2Ref },
              { name: item3Name, setName: setItem3Name, amount: item3Amount, setAmount: setItem3Amount, note: item3Note, setNote: setItem3Note, ref: item3Ref },
            ].map((it, i) => (
              <div key={i} className="grid gap-1.5">
                <Label className="text-[11px] text-muted-foreground">自定义款项 {i + 1}</Label>
                <Input
                  value={it.name}
                  onChange={(e) => it.setName(e.target.value)}
                  placeholder="内容（如 增压费）"
                  className="h-9 text-sm"
                />
                <Input
                  ref={it.ref}
                  type="number"
                  min={0}
                  step={0.01}
                  value={it.amount}
                  onChange={(e) => it.setAmount(e.target.value)}
                  onKeyDown={enter(i === 0 ? 'item1Amount' : i === 1 ? 'item2Amount' : 'item3Amount')}
                  placeholder="金额（元）"
                  className="h-9 text-sm"
                />
                <Input
                  value={it.note}
                  onChange={(e) => it.setNote(e.target.value)}
                  placeholder="备注（可选）"
                  className="h-9 text-sm"
                />
              </div>
            ))}
          </div>

          {/* v1.3.0 结余与实收区 */}
          <div className="grid gap-3 rounded-md border bg-card px-4 py-3 min-[640px]:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-[11px] text-muted-foreground">上次结余（元）</Label>
              <Input
                type="number"
                value={lastBalance}
                onChange={(e) => setLastBalance(e.target.value)}
                placeholder="0"
                className="h-9 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[11px] text-muted-foreground">应收（元）</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/60 px-3 text-sm font-semibold tabular-nums">
                {formatMoney(fee.totalAmount)}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[11px] text-muted-foreground">本次结余（元）</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/60 px-3 text-sm font-semibold tabular-nums">
                {formatMoney(curBalance)}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">是否收费</p>
                <p className="text-[11px] text-muted-foreground">开启后实收 = 应收</p>
              </div>
              <Switch checked={paid} onCheckedChange={setPaid} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[11px] text-muted-foreground">实收（元）</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/60 px-3 text-sm font-semibold tabular-nums text-primary">
                {formatMoney(paidAmount)}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[11px] text-muted-foreground">实收大写</Label>
              <div className="flex h-9 items-center truncate rounded-md border bg-muted/60 px-3 text-xs tabular-nums">
                {paidAmount > 0 ? toCNNumber(paidAmount) : '零'}
              </div>
            </div>
          </div>

          {/* 收费人 / 抄表人 / 备注 */}
          <div className="grid gap-3 rounded-md border bg-muted/40 p-3 min-[640px]:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-[11px] text-muted-foreground">收费人</Label>
              <Input
                ref={receiverRef}
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                onKeyDown={enter('receiver')}
                placeholder="收费人（可选）"
                className="h-9 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[11px] text-muted-foreground">抄表人</Label>
              <Input
                ref={readerRef}
                value={reader}
                onChange={(e) => setReader(e.target.value)}
                onKeyDown={enter('reader')}
                placeholder="抄表人（可选）"
                className="h-9 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[11px] text-muted-foreground">备注</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="备注（可选）"
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* 费用明细汇总 */}
          <div className="rounded-md border bg-card px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                电费（{fee.electricUsage} 度{hasTier ? `，${tier.label}` : '，固定电价'} × {tier.price} 元）
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
                <span className="text-muted-foreground">
                  {customName || customMeterName}（{fee.customUsage} × {n(customPrice)} 元）
                </span>
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
              <span className="text-muted-foreground">
                物业费 + 垃圾处理费（{formatMoney(n(propertyFee) + n(garbageFeeInput))}）
              </span>
              <span className="font-semibold tabular-nums">
                {formatMoney(n(propertyFee) + n(garbageFeeInput))} 元
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" variant="secondary" onClick={() => handleSubmit(true)}>
            保存并录下一户
          </Button>
          <Button type="button" onClick={() => handleSubmit(false)}>
            保存录入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
