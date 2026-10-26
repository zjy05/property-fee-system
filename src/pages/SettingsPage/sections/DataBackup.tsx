import { useRef } from 'react';
import { toast } from 'sonner';
import { Download, RotateCcw, Trash2, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { MOCK_OWNERS, MOCK_READINGS } from '@/data/types';
import type { IOwner, IReading, ISettings } from '@/data/types';

export default function DataBackup() {
  const { owners, readings, settings, setOwners, setReadings, setSettings } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const payload = { owners, readings, settings, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date();
    a.download = `物业收费数据备份-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate(),
    ).padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('数据备份已导出');
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          owners?: unknown;
          readings?: unknown;
          settings?: unknown;
        };
        if (!Array.isArray(parsed.owners) || !Array.isArray(parsed.readings) || !parsed.settings) {
          toast.error('备份文件格式不正确');
          return;
        }
        setOwners(parsed.owners as IOwner[]);
        setReadings(parsed.readings as IReading[]);
        setSettings(parsed.settings as ISettings);
        toast.success('数据已导入，当前页面已刷新');
      } catch {
        toast.error('备份文件解析失败，请确认是导出的 JSON 文件');
      }
    };
    reader.readAsText(file);
  };

  const clearDemo = () => {
    setOwners([]);
    setReadings([]);
    setSettings((prev) => ({ ...prev, demoSeeded: false }));
    toast.success('示例数据已清空');
  };

  const restoreDemo = () => {
    setOwners(MOCK_OWNERS);
    setReadings(MOCK_READINGS);
    setSettings((prev) => ({ ...prev, demoSeeded: true }));
    toast.success('示例数据已恢复');
  };

  const hasData = owners.length > 0 || readings.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>数据备份</CardTitle>
        <CardDescription>数据保存在本机浏览器，定期导出备份以防丢失；换电脑时可导入迁移。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleExport}>
            <Download className="size-4" />
            导出备份
          </Button>
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-4" />
            导入备份
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = '';
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {hasData && settings.demoSeeded && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="size-4" />
                  清空示例数据
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>清空示例数据？</AlertDialogTitle>
                  <AlertDialogDescription>
                    将删除当前全部业主档案与收费记录（仅清空示例数据，不影响单价等设置）。删除后不可恢复。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={clearDemo}>清空</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {!hasData && (
            <Button type="button" variant="outline" onClick={restoreDemo}>
              <RotateCcw className="size-4" />
              恢复示例数据
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
