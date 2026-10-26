import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch, getCurrentUser } from '@/lib/auth';
import { useAppStore } from '@/lib/store-context';
import {
  ASSIGNABLE_PERMISSIONS,
  isAdmin,
  normalizePermissions,
  permissionLabel,
} from '@/lib/permissions';

interface StaffUser {
  id: string;
  username: string;
  role: string;
  communityId: string;
  permissions: string[];
}

const PERMISSION_GROUPS = [...new Set(ASSIGNABLE_PERMISSIONS.map((p) => p.group))];

function PermissionPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">可查看范围</p>
          <p className="text-xs text-muted-foreground">不勾选 = 员工只能修改密码。</p>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange(ASSIGNABLE_PERMISSIONS.map((p) => p.key))}
          >
            全选
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>
            清空
          </Button>
        </div>
      </div>

      {PERMISSION_GROUPS.map((group) => (
        <div key={group} className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">{group}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ASSIGNABLE_PERMISSIONS.filter((p) => p.group === group).map((p) => {
              const checked = value.includes(p.key);
              return (
                <label
                  key={p.key}
                  className={
                    'flex cursor-pointer items-start gap-2 rounded-md border p-2.5 transition-colors ' +
                    (checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')
                  }
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.key)}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{p.label}</span>
                    <span className="block text-xs text-muted-foreground">{p.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StaffPage() {
  const { settings } = useAppStore();
  const me = getCurrentUser();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [permUser, setPermUser] = useState<StaffUser | null>(null);
  const [permDraft, setPermDraft] = useState<string[]>([]);
  const [permBusy, setPermBusy] = useState(false);

  const load = async () => {
    try {
      const res = await apiFetch('/api/users');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || '读取员工列表失败');
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
      setError('');
    } catch {
      setError('读取员工列表失败');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const addUser = async () => {
    if (!username.trim() || !password) {
      toast.error('用户名和初始密码必填');
      return;
    }
    if (password.length < 6) {
      toast.error('初始密码至少 6 位');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
          communityId,
          permissions: normalizePermissions(permissions),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || '添加员工失败');
        return;
      }
      toast.success(`员工 ${username.trim()} 已添加`);
      setUsername('');
      setPassword('');
      setPermissions([]);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (u: StaffUser) => {
    if (!window.confirm(`确定删除员工「${u.username}」？`)) return;
    const res = await apiFetch(`/api/users/${u.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || '删除失败');
      return;
    }
    toast.success('员工已删除');
    await load();
  };

  const openPermissions = (u: StaffUser) => {
    setPermUser(u);
    setPermDraft(normalizePermissions(u.permissions));
  };

  const savePermissions = async () => {
    if (!permUser) return;
    setPermBusy(true);
    try {
      const res = await apiFetch(`/api/users/${permUser.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: normalizePermissions(permDraft) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || '保存权限失败');
        return;
      }
      toast.success(`「${permUser.username}」的查看权限已更新`);
      setPermUser(null);
      await load();
    } finally {
      setPermBusy(false);
    }
  };

  const changePassword = async () => {
    if (!oldPassword || !newPassword) {
      toast.error('原密码和新密码必填');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('新密码至少 6 位');
      return;
    }
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
  };

  const communityName = (id: string) => settings.communities.find((c) => c.id === id)?.name ?? '全部小区';
  const permissionText = (u: StaffUser) => {
    if (u.role === 'admin') return '全部权限';
    const allowed = normalizePermissions(u.permissions);
    return allowed.length === 0 ? '仅修改密码' : allowed.map(permissionLabel).join('、');
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <UserCog className="size-5" /> 物业员工
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          只有管理员能添加账号。员工账号默认只能修改密码；勾选后只能查看对应页面，不能改数据。
        </p>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">员工列表</CardTitle>
          <CardDescription>
            当前登录：{me?.username}（{isAdmin(me) ? '管理员' : '员工'}）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>数据范围</TableHead>
                  <TableHead>可查看范围</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                      还没有员工账号
                    </TableCell>
                  </TableRow>
                )}
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.username}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                        {u.role === 'admin' ? '管理员' : '员工'}
                      </Badge>
                    </TableCell>
                    <TableCell>{communityName(u.communityId)}</TableCell>
                    <TableCell className="max-w-[280px]">
                      <span className="block truncate text-sm" title={permissionText(u)}>
                        {permissionText(u)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {u.role !== 'admin' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openPermissions(u)}
                            title="修改查看权限"
                          >
                            <ShieldCheck className="size-4" /> 权限
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={u.id === me?.id || u.role === 'admin'}
                          onClick={() => void removeUser(u)}
                          title={
                            u.id === me?.id
                              ? '不能删除自己'
                              : u.role === 'admin'
                                ? '管理员账号不能在这里删除'
                                : '删除员工'
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4" /> 添加员工
            </CardTitle>
            <CardDescription>
              填账号信息，再勾选允许查看的页面；不勾选则员工只能修改密码。初始密码至少 6 位。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>用户名</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="如 shoufeiyuan01"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>初始密码</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>数据范围</Label>
              <Select value={communityId || '__all'} onValueChange={(v) => setCommunityId(v === '__all' ? '' : v)}>
                <SelectTrigger>
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

            <PermissionPicker value={permissions} onChange={setPermissions} />

            <Button onClick={() => void addUser()} disabled={busy}>
              <Plus className="size-4" /> {busy ? '添加中…' : '添加员工'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4" /> 修改我的密码
            </CardTitle>
            <CardDescription>
              当前账号：{me?.username}。员工也可以从「我的账户」修改。
            </CardDescription>
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
            <Button variant="outline" onClick={() => void changePassword()}>
              <KeyRound className="size-4" /> 修改密码
            </Button>
            <Button asChild variant="ghost">
              <Link to="/account">我的账户 / 退出登录</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(permUser)} onOpenChange={(o) => !o && setPermUser(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>修改查看权限</DialogTitle>
            <DialogDescription>
              正在设置「{permUser?.username}」。员工只能查看勾选页面，不能修改数据；保存后请让员工重新登录生效。
            </DialogDescription>
          </DialogHeader>
          <PermissionPicker value={permDraft} onChange={setPermDraft} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPermUser(null)}>
              取消
            </Button>
            <Button type="button" onClick={() => void savePermissions()} disabled={permBusy}>
              <Pencil className="size-4" /> {permBusy ? '保存中…' : '保存权限'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
