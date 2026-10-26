import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/lib/store-context';

export default function FeeSettings() {
  const { settings, setSettings } = useAppStore();
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [receiptTitle, setReceiptTitle] = useState(settings.receiptTitle);
  const [tier1Limit, setTier1Limit] = useState(String(settings.electricTier1Limit));
  const [tier2Limit, setTier2Limit] = useState(String(settings.electricTier2Limit));
  const [tier1Price, setTier1Price] = useState(String(settings.electricTier1Price));
  const [tier2Price, setTier2Price] = useState(String(settings.electricTier2Price));
  const [tier3Price, setTier3Price] = useState(String(settings.electricTier3Price));
  const [receiptNoPrefix, setReceiptNoPrefix] = useState(settings.receiptNoPrefix);
  const [receiptNoStart, setReceiptNoStart] = useState(String(settings.receiptNoStart));

  const handleSave = () => {
    const t1l = Number(tier1Limit);
    const t2l = Number(tier2Limit);
    const t1p = Number(tier1Price);
    const t2p = Number(tier2Price);
    const t3p = Number(tier3Price);
    const start = Number(receiptNoStart);
    if (!companyName.trim()) {
      toast.error('请填写收费单位名称');
      return;
    }
    const nums = [t1l, t2l, t1p, t2p, t3p];
    if (nums.some((v) => !Number.isFinite(v) || v < 0)) {
      toast.error('单价与阶梯电量必须为非负数字');
      return;
    }
    if (t1l >= t2l) {
      toast.error('第二阶梯起始电量应大于第一阶梯上限');
      return;
    }
    if (!Number.isInteger(start) || start < 0) {
      toast.error('起始编号必须为非负整数');
      return;
    }
    setSettings((prev) => ({
      ...prev,
      companyName: companyName.trim(),
      receiptTitle: receiptTitle.trim() || '收款收据',
      electricTier1Limit: t1l,
      electricTier2Limit: t2l,
      electricTier1Price: t1p,
      electricTier2Price: t2p,
      electricTier3Price: t3p,
      receiptNoPrefix: receiptNoPrefix.trim() || 'SD',
      receiptNoStart: start,
    }));
    toast.success('收费设置已保存');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>收费设置</CardTitle>
        <CardDescription>
          单位信息、阶梯电价（按年度累计用电量）与收据编号规则。水价与垃圾处理费在各小区管理中单独设置；阶梯电价仅对启用「阶梯计费」的小区生效（未启用的小区按小区固定电价计费）。
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid min-w-0 gap-1.5">
            <Label>收费单位名称</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
          <div className="grid min-w-0 gap-1.5">
            <Label>票据标题</Label>
            <Input value={receiptTitle} onChange={(e) => setReceiptTitle(e.target.value)} />
          </div>
        </div>

        <div className="rounded-md border bg-muted/40 p-3">
          <p className="mb-2 text-sm font-medium">阶梯电价（按年度累计用电量，元/度）</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">第一阶梯上限（度）</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={tier1Limit}
                onChange={(e) => setTier1Limit(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">第二阶梯上限（度）</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={tier2Limit}
                onChange={(e) => setTier2Limit(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">第一阶梯单价（元/度）</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={tier1Price}
                onChange={(e) => setTier1Price(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">第二阶梯单价（元/度）</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={tier2Price}
                onChange={(e) => setTier2Price(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">第三阶梯单价（元/度）</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={tier3Price}
                onChange={(e) => setTier3Price(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>收据编号前缀</Label>
            <Input
              value={receiptNoPrefix}
              onChange={(e) => setReceiptNoPrefix(e.target.value)}
              placeholder="如 SD"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>编号起始数字</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={receiptNoStart}
              onChange={(e) => setReceiptNoStart(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Button type="button" onClick={handleSave}>
            保存设置
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
