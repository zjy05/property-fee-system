import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/auth';

interface LoginLog {
  id: string;
  username: string;
  success: number;
  ip: string;
  user_agent: string;
  created_at: string;
}

function fmtTime(raw: string) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString('zh-CN', { hour12: false });
}

export default function LoginLogsPage() {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/login-logs')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || '读取登录日志失败');
          return;
        }
        setLogs(data.logs || []);
      })
      .catch(() => setError('读取登录日志失败'));
  }, []);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <ScrollText className="size-5" /> 登录日志
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          记录每次登录的成功/失败、时间和来源 IP，方便排查账号问题。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">最近 300 条</CardTitle>
          <CardDescription>只保留登录事件，不记录密码。</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead>结果</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>客户端</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      暂无登录日志
                    </TableCell>
                  </TableRow>
                )}
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap">{fmtTime(l.created_at)}</TableCell>
                    <TableCell className="font-medium">{l.username || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={l.success ? 'default' : 'destructive'}>
                        {l.success ? '成功' : '失败'}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{l.ip || '—'}</TableCell>
                    <TableCell className="max-w-[380px] truncate text-xs text-muted-foreground" title={l.user_agent}>
                      {l.user_agent || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
