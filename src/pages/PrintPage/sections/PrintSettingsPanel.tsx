import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { useAppStore } from '@/lib/store-context';

const TEMPLATES = [
  { id: 'hengji' as const, name: '演示二期收据', desc: '电费·水费·物业费·增压费·生活垃圾处置费＋应收/实收（对齐现有 Excel）' },
  { id: 'laolou' as const, name: '演示小区阶梯收据', desc: '年度合计＋内容明细（上月/本月）＋物业费/垃圾费小计＋阶梯电价备注（对齐老楼 Excel）' },
  { id: 'yida' as const, name: '易达标准收据', desc: '7 列明细，含损耗、上次/本次结余、自定义款项，适合复杂计费' },
];

export default function PrintSettingsPanel({ onManageProfiles }: { onManageProfiles: () => void }) {
  const { settings, setSettings } = useAppStore();
  const paper = settings.paper;
  const template = settings.receiptTemplate ?? 'hengji';

  const update = (key: keyof typeof paper, value: string) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return;
    setSettings((prev) => ({ ...prev, paper: { ...prev.paper, [key]: num } }));
  };

  const applyProfile = (p: (typeof settings.paperProfiles)[number]) => {
    const { id: _id, name: _name, ...paper } = p;
    setSettings((prev) => ({ ...prev, paper }));
  };

  const fields = [
    { key: 'width' as const, label: '纸宽 (mm)', hint: '三联针式常见 180' },
    { key: 'height' as const, label: '单张纸高 (mm)', hint: '撕单线间距，三联常见 210' },
    { key: 'marginTop' as const, label: '上边距 (mm)' },
    { key: 'marginBottom' as const, label: '下边距 (mm)' },
    { key: 'marginLeft' as const, label: '左边距 (mm)' },
    { key: 'marginRight' as const, label: '右边距 (mm)' },
    { key: 'lineHeight' as const, label: '行距倍数', step: 0.1 },
    { key: 'fontSize' as const, label: '字号 (px)' },
  ];

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>收据版式</CardTitle>
          <CardDescription>切换后预览与打印同时生效。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {TEMPLATES.map((t) => {
            const active = template === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSettings((prev) => ({ ...prev, receiptTemplate: t.id }))}
                className={
                  'rounded-md border p-2 text-left transition-colors ' +
                  (active ? 'border-primary bg-primary/5' : 'hover:bg-muted/60')
                }
              >
                <div className="flex items-center gap-2">
                  <span
                    className={
                      'inline-block size-3 rounded-full border ' +
                      (active ? 'border-primary bg-primary' : 'border-muted-foreground/50')
                    }
                  />
                  <span className="text-sm font-medium">{t.name}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.desc}</p>
              </button>
            );
          })}
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>针式打印机</CardTitle>
          <CardDescription>留空 = 使用 Windows 默认打印机；填了名称后，直打固定送这台。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1.5">
          <Label>打印机名称</Label>
          <Input
            value={settings.printerName ?? ''}
            onChange={(e) => setSettings((prev) => ({ ...prev, printerName: e.target.value }))}
            placeholder="如 Deli DL-625K"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            这台电脑有两台打印机时建议填写，避免 Windows 默认打印机被切到激光机。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>纸张尺寸</CardTitle>
          <CardDescription>选已保存的纸张，或点「自定义…」新建并保存一份。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-1.5">
            {settings.paperProfiles.map((p) => {
              const active = paper.width === p.width && paper.height === p.height;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyProfile(p)}
                  className={
                    'rounded-full border px-2.5 py-1 text-xs transition-colors ' +
                    (active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted/60')
                  }
                >
                  {p.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={onManageProfiles}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs transition-colors hover:bg-muted/60"
            >
              <Plus className="size-3" /> 自定义…
            </button>
          </div>
          {fields.map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <Label>
                {f.label}
                {f.hint && <span className="ml-1 text-xs text-muted-foreground">{f.hint}</span>}
              </Label>
              <Input
                type="number"
                min={0}
                step={f.step ?? 1}
                value={paper[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
              />
            </div>
          ))}
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            打印提示：系统打印对话框里选「实际大小 / 100%」，不要勾选「缩放以适应」；针式打印机请把纸张起始位置对准撕单线。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
