import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
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
import { DEFAULT_SETTINGS } from '@/data/types';
import type { IPaperProfile, IPrintPaper } from '@/data/types';

function pickPaper(p: IPaperProfile): IPrintPaper {
  return {
    width: p.width,
    height: p.height,
    marginTop: p.marginTop,
    marginBottom: p.marginBottom,
    marginLeft: p.marginLeft,
    marginRight: p.marginRight,
    lineHeight: p.lineHeight,
    fontSize: p.fontSize,
  };
}

function fromPaper(paper: IPrintPaper, count: number): IPaperProfile {
  return {
    id: `paper-${Date.now()}`,
    name: `自定义纸张 ${count + 1}`,
    ...paper,
  };
}

export default function PaperProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { settings, setSettings } = useAppStore();
  const profiles = settings.paperProfiles;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<IPaperProfile>(() => fromPaper(settings.paper, profiles.length));

  // 每次打开都以「当前正在用的纸张」为起点，避免沿用上次遗留的表单值
  useEffect(() => {
    if (open) {
      setEditingId(null);
      setForm(fromPaper(settings.paper, settings.paperProfiles.length));
    }
  }, [open, settings.paper, settings.paperProfiles.length]);

  const resetForm = (from?: IPaperProfile) => {
    if (from) {
      setEditingId(from.id);
      setForm({ ...from });
    } else {
      setEditingId(null);
      setForm(fromPaper(settings.paper, profiles.length));
    }
  };

  const setNum = (key: keyof IPrintPaper, value: string) => {
    const n = Number(value);
    setForm((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : 0 }));
  };

  const validate = () => {
    if (!form.name.trim()) {
      toast.error('请给纸张起个名字');
      return false;
    }
    if (!(form.width > 0) || !(form.height > 0)) {
      toast.error('纸宽和纸高必须大于 0');
      return false;
    }
    if ([form.marginTop, form.marginBottom, form.marginLeft, form.marginRight].some((n) => n < 0)) {
      toast.error('边距不能为负数');
      return false;
    }
    if (form.width <= form.marginLeft + form.marginRight || form.height <= form.marginTop + form.marginBottom) {
      toast.error('左右边距/上下边距不能大于纸宽/纸高');
      return false;
    }
    return true;
  };

  const save = (apply: boolean) => {
    if (!validate()) return;
    const next: IPaperProfile = {
      ...form,
      name: form.name.trim(),
      id: editingId ?? `paper-${Date.now()}`,
    };
    const nextProfiles = editingId
      ? profiles.map((p) => (p.id === editingId ? next : p))
      : [...profiles, next];
    setSettings((prev) => ({
      ...prev,
      paperProfiles: nextProfiles,
      ...(apply ? { paper: pickPaper(next) } : {}),
    }));
    setEditingId(next.id);
    toast.success(apply ? `纸张「${next.name}」已保存并应用` : `纸张「${next.name}」已保存`);
    if (apply) onOpenChange(false);
  };

  const apply = (p: IPaperProfile) => {
    setSettings((prev) => ({ ...prev, paper: pickPaper(p) }));
    toast.success(`已应用「${p.name}」`);
    onOpenChange(false);
  };

  const remove = (p: IPaperProfile) => {
    if (!window.confirm(`删除纸张「${p.name}」？删除后只影响纸张列表，不影响已录入数据。`)) return;
    setSettings((prev) => ({ ...prev, paperProfiles: prev.paperProfiles.filter((x) => x.id !== p.id) }));
    if (editingId === p.id) resetForm();
    toast.success('纸张已删除');
  };

  const restoreDefaults = () => {
    if (!window.confirm('恢复为默认 5 个纸张？你自定义的纸张会被清空。')) return;
    setSettings((prev) => ({ ...prev, paperProfiles: DEFAULT_SETTINGS.paperProfiles }));
    resetForm();
    toast.success('已恢复默认纸张');
  };

  const active = (p: IPaperProfile) =>
    settings.paper.width === p.width && settings.paper.height === p.height;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>纸张管理</DialogTitle>
          <DialogDescription>
            增删改纸张尺寸、边距、行距和字号；保存后可直接应用，打印时按这套参数出纸。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-5">
          <div className="grid content-start gap-2 md:col-span-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">纸张列表（{profiles.length}）</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => resetForm()}>
                  <Plus className="size-4" /> 新建
                </Button>
                <Button size="sm" variant="ghost" onClick={restoreDefaults}>
                  <RotateCcw className="size-4" /> 默认
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              {profiles.length === 0 && (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  还没有纸张，点「新建」添加。
                </p>
              )}
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className={
                    'flex flex-wrap items-center gap-2 rounded-md border p-2 ' +
                    (active(p) ? 'border-primary bg-primary/5' : '')
                  }
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p.name}
                      {active(p) && <span className="ml-2 text-xs text-primary">当前</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.width}×{p.height}mm · 边距 {p.marginTop}/{p.marginRight}/{p.marginBottom}/{p.marginLeft}mm · 行距 {p.lineHeight} · 字号 {p.fontSize}px
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant={active(p) ? 'secondary' : 'outline'} onClick={() => apply(p)}>
                      <Check className="size-3.5" /> 应用
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => resetForm(p)}>
                      <Pencil className="size-3.5" /> 编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove(p)}
                    >
                      <Trash2 className="size-3.5" /> 删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid content-start gap-3 rounded-md border p-3 md:col-span-2">
            <p className="text-sm font-medium">{editingId ? '编辑纸张' : '新增纸张'}</p>
            <div className="grid gap-1.5">
              <Label>名称</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="如 三联 180×210" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label>纸宽 (mm)</Label>
                <Input type="number" value={form.width} onChange={(e) => setNum('width', e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>纸高 (mm)</Label>
                <Input type="number" value={form.height} onChange={(e) => setNum('height', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['marginTop', '上边距'],
                ['marginBottom', '下边距'],
                ['marginLeft', '左边距'],
                ['marginRight', '右边距'],
              ] as const).map(([key, label]) => (
                <div key={key} className="grid gap-1.5">
                  <Label>{label} (mm)</Label>
                  <Input type="number" value={form[key]} onChange={(e) => setNum(key, e.target.value)} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label>行距倍数</Label>
                <Input type="number" step={0.1} value={form.lineHeight} onChange={(e) => setNum('lineHeight', e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>字号 (px)</Label>
                <Input type="number" value={form.fontSize} onChange={(e) => setNum('fontSize', e.target.value)} />
              </div>
            </div>
            <DialogFooter className="mt-1 flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => save(false)}>
                仅保存
              </Button>
              <Button onClick={() => save(true)}>
                <Check className="size-4" /> 保存并应用
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
