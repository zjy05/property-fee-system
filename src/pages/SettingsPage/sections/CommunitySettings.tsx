import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAppStore } from '@/lib/store-context';
import { uid } from '@/lib/fee';
import type { ICommunity } from '@/data/types';

/** 逗号分隔输入转楼栋数组，兼容全角逗号 */
function parseBuildings(text: string): string[] {
  return text
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function CommunitySettings({ readOnly = false }: { readOnly?: boolean }) {
  const { owners, settings, setSettings } = useAppStore();
  const [editing, setEditing] = useState<ICommunity | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState('');
  const [buildingsText, setBuildingsText] = useState('');
  const [waterPrice, setWaterPrice] = useState('');
  const [garbageFee, setGarbageFee] = useState('');
  const [hasTier, setHasTier] = useState(true);
  const [electricPrice, setElectricPrice] = useState('');
  const [lineFee, setLineFee] = useState('');
  // v1.3.0：损耗率（%）与自定义抄表行名称
  const [waterLossRate, setWaterLossRate] = useState('');
  const [electricLossRate, setElectricLossRate] = useState('');
  const [customMeterName, setCustomMeterName] = useState('');

  const startEdit = (c: ICommunity | null) => {
    setEditing(c);
    setIsNew(!c);
    setName(c?.name ?? '');
    setBuildingsText(c ? c.buildings.join('、') : '');
    setWaterPrice(String(c?.waterPrice ?? settings.waterPrice));
    setGarbageFee(String(c?.garbageFee ?? settings.garbageFee));
    setHasTier(c?.hasTier ?? true);
    setElectricPrice(String(c?.electricPrice ?? settings.electricTier1Price));
    setLineFee(String(c?.lineFee ?? 0));
    setWaterLossRate(String(c?.waterLossRate ?? 0));
    setElectricLossRate(String(c?.electricLossRate ?? 0));
    setCustomMeterName(c?.customMeterName || '自定义');
  };

  const remove = (id: string) => {
    const used = owners.some((o) => o.communityId === id);
    if (used) {
      toast.error('该小区下仍有业主档案，请先转移业主再删除');
      return;
    }
    setSettings((prev) => ({
      ...prev,
      communities: prev.communities.filter((c) => c.id !== id),
    }));
    toast.success('小区已删除');
  };

  const save = () => {
    if (!name.trim()) {
      toast.error('请填写小区名称');
      return;
    }
    const wp = Number(waterPrice);
    const gf = Number(garbageFee);
    const ep = Number(electricPrice);
    const lf = Number(lineFee);
    const wlr = Number(waterLossRate);
    const elr = Number(electricLossRate);
    if (!Number.isFinite(wp) || wp < 0 || !Number.isFinite(gf) || gf < 0) {
      toast.error('水价与垃圾处理费必须为非负数字');
      return;
    }
    if (!Number.isFinite(ep) || ep < 0 || !Number.isFinite(lf) || lf < 0) {
      toast.error('电价与线路维护费必须为非负数字');
      return;
    }
    if (!Number.isFinite(wlr) || wlr < 0 || !Number.isFinite(elr) || elr < 0) {
      toast.error('损耗率必须为非负数字（%）');
      return;
    }
    const buildings = parseBuildings(buildingsText);
    setSettings((prev) => {
      if (editing) {
        return {
          ...prev,
          communities: prev.communities.map((c) =>
            c.id === editing.id
              ? {
                  ...c,
                  name: name.trim(),
                  buildings,
                  waterPrice: wp,
                  garbageFee: gf,
                  hasTier,
                  electricPrice: ep,
                  lineFee: lf,
                  waterLossRate: wlr,
                  electricLossRate: elr,
                  customMeterName: customMeterName.trim() || '自定义',
                }
              : c,
          ),
        };
      }
      const community: ICommunity = {
        id: uid(),
        name: name.trim(),
        buildings,
        waterPrice: wp,
        garbageFee: gf,
        hasTier,
        electricPrice: ep,
        lineFee: lf,
        waterLossRate: wlr,
        electricLossRate: elr,
        customMeterName: customMeterName.trim() || '自定义',
      };
      return { ...prev, communities: [...prev.communities, community] };
    });
    toast.success(isNew ? '小区已新增' : '小区设置已保存');
    setEditing(null);
    setIsNew(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>小区管理</CardTitle>
        <CardDescription>
          管理多个小区，每个小区可单独设置楼栋、水价与垃圾处理费（电价阶梯全小区统一，在「收费设置」中调整）。
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {settings.communities.map((c) => {
          const usedCount = owners.filter((o) => o.communityId === c.id).length;
          return (
            <div key={c.id} className="grid gap-1.5 rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="grid min-w-0 gap-0.5">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    水价 {c.waterPrice} 元/吨 · 垃圾处理费 {c.garbageFee} 元/户/月
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.hasTier
                      ? `阶梯计费（${c.electricPrice || settings.electricTier1Price} 元/度起）`
                      : `固定电价 ${c.electricPrice} 元/度`}
                    {c.lineFee > 0 && ` · 线路维护费 ${c.lineFee} 元/度`}
                    {(c.waterLossRate ?? 0) > 0 && ` · 水损耗 ${c.waterLossRate}%`}
                    {(c.electricLossRate ?? 0) > 0 && ` · 电损耗 ${c.electricLossRate}%`}
                    {c.customMeterName && c.customMeterName !== '自定义' && ` · 抄表行「${c.customMeterName}」`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    楼栋：{c.buildings.length > 0 ? c.buildings.join('、') : '未设置'}
                    {usedCount > 0 && ` · ${usedCount} 位业主`}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(c)}>
                      编辑
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={usedCount > 0}
                      title={usedCount > 0 ? '请先转移该小区业主' : '删除小区'}
                      onClick={() => remove(c.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {!readOnly && (
          <Button type="button" variant="outline" onClick={() => startEdit(null)}>
            <Plus className="size-4" />
            新增小区
          </Button>
        )}
      </CardContent>

      <Dialog
        open={Boolean(editing) || isNew}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setIsNew(false);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? '新增小区' : '编辑小区'}</DialogTitle>
            <DialogDescription>设置小区名称、楼栋列表与各自收费参数。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>小区名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 演示小区" />
            </div>
            <div className="grid gap-1.5">
              <Label>楼栋列表</Label>
              <Input
                value={buildingsText}
                onChange={(e) => setBuildingsText(e.target.value)}
                placeholder="如 中楼、东楼、西楼（用逗号分隔）"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid min-w-0 gap-1.5">
                <Label>水价（元/吨）</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={waterPrice}
                  onChange={(e) => setWaterPrice(e.target.value)}
                />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label>垃圾处理费（元/户/月）</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={garbageFee}
                  onChange={(e) => setGarbageFee(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>电费计费方式</Label>
              <div className="flex gap-1 rounded-md border bg-muted/40 p-1">
                <button
                  type="button"
                  className={`flex-1 rounded px-2 py-1 text-sm transition-colors ${
                    hasTier ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'
                  }`}
                  onClick={() => setHasTier(true)}
                >
                  阶梯计费
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded px-2 py-1 text-sm transition-colors ${
                    !hasTier ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'
                  }`}
                  onClick={() => setHasTier(false)}
                >
                  固定电价
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {hasTier
                  ? '按全局阶梯电价计费（在「收费设置」中调整三档价格）'
                  : '本小区所有业主按固定电价计费，不参与阶梯'}
              </p>
            </div>
            {!hasTier && (
              <div className="grid gap-1.5">
                <Label>固定电价（元/度）</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.001}
                  value={electricPrice}
                  onChange={(e) => setElectricPrice(e.target.value)}
                  placeholder="如 0.568"
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>线路维护费（元/度，按用电量计收；不需要填 0）</Label>
              <Input
                type="number"
                min={0}
                step={0.001}
                value={lineFee}
                onChange={(e) => setLineFee(e.target.value)}
                placeholder="如 0.082"
              />
            </div>
            {/* v1.3.0：损耗率与自定义抄表行名称 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid min-w-0 gap-1.5">
                <Label>水表损耗率（%，按抄见数计；不需要填 0）</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={waterLossRate}
                  onChange={(e) => setWaterLossRate(e.target.value)}
                  placeholder="如 5 = 5%"
                />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label>电表损耗率（%，按抄见数计；不需要填 0）</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={electricLossRate}
                  onChange={(e) => setElectricLossRate(e.target.value)}
                  placeholder="如 5 = 5%"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>第三行抄表名称（如 动力电 / 二次供水）</Label>
              <Input
                value={customMeterName}
                onChange={(e) => setCustomMeterName(e.target.value)}
                placeholder="默认 自定义"
              />
              <p className="text-xs text-muted-foreground">
                抄表录入与收据打印中第三行抄表使用的名称。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(null);
                setIsNew(false);
              }}
            >
              取消
            </Button>
            <Button type="button" onClick={save}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
