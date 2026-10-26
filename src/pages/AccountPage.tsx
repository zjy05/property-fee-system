import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { KeyRound, LogOut, ShieldCheck, UserCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, logout } from '@/lib/auth';
import { useCurrentUser } from '@/lib/use-current-user';
import { useAppStore } from '@/lib/store-context';
import { isAdmin, normalizePermissions, permissionLabel } from '@/lib/permissions';

export default function AccountPage() {
  const me = useCurrentUser();
  const nav = useNavigate();
  const { settings } = useAppStore();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (!me) return null;

  const admin = isAdmin(me);
  const allowed = normalizePermissions(me.permissions);
  const communityName =
    settings.communities.find((c) => c.id === me.communityId)?.name ?? '全部小区';

  const changePassword = async () => {
    if (!oldPassword || !newPassword) {
      toast.error('原密码和新密码必填');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('新密码至少 6 位');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch('/api/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || '修改密码失败');
        return;
      }
      toast.success('密码已修改，下次登录请使用新密码');
      setOldPassword('');
      setNewPassword('');
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    if (!window.confirm('确定退出登录？')) return;
    await logout();
    nav('/login', { replace: true });
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <KeyRound className="size-5" /> 我的账户
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          查看自己的账号信息和可查看范围，修改登录密码。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" /> 账号信息
          </CardTitle>
          <CardDescription>
            {admin ? '管理员账号，默认拥有全部权限。' : '员工账号，只能查看管理员勾选的内容。'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
            <div>
              <p className="font-medium">{me.username}</p>
              <p className="text-xs text-muted-foreground">
                {admin ? '管理员' : '员工'} · 数据范围：{communityName}
              </p>
            </div>
            <Badge variant={admin ? 'default' : 'secondary'}>{admin ? '全部权限' : '受限账号'}</Badge>
          </div>

          {!admin && (
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">可查看的页面</span>
              {allowed.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  暂时没有可查看的页面，只能修改密码。需要查看更多内容请联系管理员。
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {allowed.map((key) => (
                    <Badge key={key} variant="outline">
                      {permissionLabel(key)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {admin && (
            <Button asChild variant="outline" className="w-fit">
              <Link to="/data/staff">
                <UserCog className="size-4" /> 去物业员工页管理账号
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" /> 修改密码
          </CardTitle>
          <CardDescription>修改后下次登录使用新密码，当前登录不会中断。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>原密码</Label>
            <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>新密码</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少 6 位"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void changePassword()} disabled={busy}>
              <KeyRound className="size-4" /> {busy ? '修改中…' : '修改密码'}
            </Button>
            <Button variant="outline" onClick={() => void doLogout()}>
              <LogOut className="size-4" /> 退出登录
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
