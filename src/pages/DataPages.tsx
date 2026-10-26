import { useState } from 'react';
import { toast } from 'sonner';
import { Building2, Landmark, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/lib/store-context';
import CommunitySettings from '@/pages/SettingsPage/sections/CommunitySettings';
import { getCurrentUser } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';

export function CommunityInfoPage() {
  const readOnly = !isAdmin(getCurrentUser());
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Building2 className="size-5" /> 小区信息
          {readOnly && <Badge variant="outline">只读</Badge>}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          维护小区、楼栋和收费参数；这里的楼栋会出现在业主档案的「楼栋」下拉里。
        </p>
      </div>
      <CommunitySettings readOnly={readOnly} />
    </div>
  );
}

export function CompanyInfoPage() {
  const { settings, setSettings } = useAppStore();
  const readOnly = !isAdmin(getCurrentUser());
  const [form, setForm] = useState({
    companyOrg: settings.companyOrg,
    companyLicenseNo: settings.companyLicenseNo ?? '',
    companyLegalPerson: settings.companyLegalPerson ?? '',
    companyAddress: settings.companyAddress ?? '',
    companyPhone: settings.companyPhone ?? '',
    companyName: settings.companyName,
    receiptTitle: settings.receiptTitle,
    techOwner: settings.techOwner,
    techPhone: settings.techPhone,
    techSupport: settings.techSupport,
  });

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    setSettings((prev) => ({ ...prev, ...form }));
    toast.success('物业信息已保存，并同步到服务器');
  };

  const fields: { key: keyof typeof form; label: string; placeholder?: string; hint?: string }[] = [
    { key: 'companyOrg', label: '物业公司全称', placeholder: '如 演示物业服务有限公司' },
    { key: 'companyLicenseNo', label: '统一社会信用代码', placeholder: '营业执照上的 18 位代码' },
    { key: 'companyLegalPerson', label: '法定代表人', placeholder: '姓名' },
    { key: 'companyAddress', label: '公司地址', placeholder: '营业执照住所 / 实际办公地址' },
    { key: 'companyPhone', label: '公司电话', placeholder: '座机或手机' },
    { key: 'companyName', label: '收费单位简称', placeholder: '如 演示物业服务处', hint: '收据/打印页顶部使用' },
    { key: 'receiptTitle', label: '收据标题', placeholder: '收款收据' },
    { key: 'techOwner', label: '技术负责人', placeholder: '姓名' },
    { key: 'techPhone', label: '技术负责人电话', placeholder: '手机号' },
    { key: 'techSupport', label: '技术支持说明', placeholder: '系统使用中如有问题，请联系…' },
  ];

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Landmark className="size-5" /> 物业信息
          {readOnly && <Badge variant="outline">只读</Badge>}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          公司名称、收据抬头和技术支持信息；营业执照信息到了之后可以继续补统一社会信用代码、地址等。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">公司资料</CardTitle>
          <CardDescription>{readOnly ? '只读查看；修改请使用管理员账号。' : '保存后会立即同步到所有端。'}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {fields.map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <Label>
                {f.label}
                {f.hint && <span className="ml-2 text-xs text-muted-foreground">{f.hint}</span>}
              </Label>
              <Input
                value={form[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                readOnly={readOnly}
              />
            </div>
          ))}
          {!readOnly && (
            <div className="flex justify-end">
              <Button onClick={save}>
                <Save className="size-4" /> 保存物业信息
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
