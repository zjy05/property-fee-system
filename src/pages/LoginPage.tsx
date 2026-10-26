import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReceiptText, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { login } from '@/lib/auth';
import { landingPath } from '@/lib/permissions';

export default function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState('admin');
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(username.trim(), pwd);
      toast.success('登录成功');
      nav(landingPath(user), { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-xl backdrop-blur">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ReceiptText className="size-6" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold">物业收费系统</h1>
            <p className="text-sm text-muted-foreground">水电费台账与打印</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">用户名</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="请输入密码"
                className="pl-9"
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '登录中…' : '登 录'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">默认管理员：admin / 0</p>
        </div>
      </form>
    </div>
  );
}
