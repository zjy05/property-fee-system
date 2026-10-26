import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/lib/store-context';
import FeeSettings from './sections/FeeSettings';
import CommunitySettings from './sections/CommunitySettings';
import DataBackup from './sections/DataBackup';

function AboutCard() {
  const { settings } = useAppStore();
  const [version, setVersion] = useState('v1.2.7');
  useEffect(() => {
    fetch('/api/version')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.version) setVersion(`v${d.version}`);
      })
      .catch(() => {});
  }, []);
  const items = [
    { label: '服务单位（物业公司）', value: settings.companyOrg },
    { label: '软件技术负责人', value: settings.techOwner },
    { label: '技术支持电话', value: settings.techPhone },
    { label: '技术支持说明', value: settings.techSupport },
    { label: '项目开源信息', value: settings.openSource },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>关于</CardTitle>
        <CardDescription>软件版本与开发者信息。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {items.map((it) => (
          <div key={it.label} className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">{it.label}</span>
            <span>{it.value}</span>
          </div>
        ))}
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          物业收费系统 {version} · 水电费台账、抄表计费与针式收据打印。数据实时同步到服务器数据库，并支持浏览器本地缓存。
        </p>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { settings } = useAppStore();
  const settingsKey = [
    settings.companyName,
    settings.receiptTitle,
    settings.waterPrice,
    settings.garbageFee,
    settings.electricTier1Limit,
    settings.electricTier2Limit,
    settings.electricTier1Price,
    settings.electricTier2Price,
    settings.electricTier3Price,
    settings.receiptNoPrefix,
    settings.receiptNoStart,
  ].join('|');

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCog className="size-4" /> 账号与权限
          </CardTitle>
          <CardDescription>添加物业员工、按小区限定数据范围、修改登录密码。</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/data/staff">
              <UserCog className="size-4" /> 物业员工 / 修改密码
            </Link>
          </Button>
        </CardContent>
      </Card>
      <FeeSettings key={settingsKey} />
      <CommunitySettings />
      <DataBackup />

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Info className="size-4" />
              使用说明
            </span>
          </CardTitle>
          <CardDescription>几个小提示，帮你用好这个系统。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm leading-relaxed text-muted-foreground">
          <p>1. 台账页录入抄表读数，系统按单价自动算费；打印前可在打印中心调整纸宽、边距、行距等参数并实时预览。</p>
          <p>2. 针式打印机打印时，请在系统打印对话框选择「实际大小 / 100%」，不要缩放，并根据纸张位置微调边距。</p>
          <p>3. 数据实时同步到服务器数据库（Docker 内），左下角可查看同步状态与服务器时间；浏览器本地也有缓存，断网也能查看。</p>
        </CardContent>
      </Card>

      <AboutCard />
    </div>
  );
}
