import { useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart3,
  BookOpenText,
  Building2,
  Home,
  KeyRound,
  Landmark,
  Printer,
  ReceiptText,
  ScrollText,
  Settings as SettingsIcon,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import { SyncStatusBar } from '@/components/SyncStatusBar';
import { refreshCurrentUser } from '@/lib/auth';
import { useCurrentUser } from '@/lib/use-current-user';
import { canAccess, type PermissionKey } from '@/lib/permissions';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';

interface NavLeaf {
  path: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
}

interface NavGroup {
  label?: string;
  items: NavLeaf[];
}

const NAV: NavGroup[] = [
  {
    items: [{ path: '/', label: '平台数据', icon: Home, permission: 'dashboard' }],
  },
  {
    label: '数据',
    items: [
      { path: '/data/community', label: '小区信息', icon: Building2, permission: 'community' },
      { path: '/data/company', label: '物业信息', icon: Landmark, permission: 'company' },
      { path: '/data/staff', label: '物业员工', icon: UserCog, permission: 'staff' },
    ],
  },
  {
    label: '资产',
    items: [{ path: '/assets/owners', label: '业主档案', icon: Users, permission: 'owners' }],
  },
  {
    label: '台账',
    items: [
      { path: '/ledger/analysis', label: '运营分析', icon: BarChart3, permission: 'analysis' },
      { path: '/ledger/summary', label: '小区费用汇总', icon: BookOpenText, permission: 'summary' },
      { path: '/ledger/payments', label: '缴费记录', icon: Wallet, permission: 'payments' },
      { path: '/ledger/arrears', label: '小区欠费', icon: AlertTriangle, permission: 'arrears' },
    ],
  },
  {
    items: [
      { path: '/print', label: '打印中心', icon: Printer, permission: 'print' },
      { path: '/login-logs', label: '登录日志', icon: ScrollText, permission: 'loginLogs' },
      { path: '/settings', label: '设置', icon: SettingsIcon, permission: 'settings' },
    ],
  },
  {
    label: '账户',
    items: [{ path: '/account', label: '我的账户', icon: KeyRound }],
  },
];

function isActive(pathname: string, path: string) {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(path + '/');
}

export const Layout = () => {
  const { pathname } = useLocation();
  const user = useCurrentUser();

  // 管理员改了员工权限后，员工刷新页面/重新进入即可拿到最新权限
  useEffect(() => {
    void refreshCurrentUser().catch(() => {});
  }, []);
  const nav = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || canAccess(user, item.permission)),
  })).filter((group) => group.items.length > 0);
  const all = nav.flatMap((g) => g.items);
  const current = all.find((item) => isActive(pathname, item.path));

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ReceiptText className="size-4" />
            </div>
            <div className="leading-tight sidebar-vertical">
              <p className="text-sm font-semibold">物业收费系统</p>
              <p className="text-xs text-muted-foreground sidebar-vertical-sub">平台数据 · 台账 · 打印</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {nav.map((group, gi) => (
            <SidebarGroup key={group.label ?? `leaf-${gi}`} className="py-0">
              {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.path);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <NavLink to={item.path} end={item.path === '/'}>
                            <item.icon />
                            <span className="sidebar-nav-label">{item.label}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <SyncStatusBar />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur md:px-4">
          <SidebarTrigger />
          <span className="text-sm font-medium">{current?.label ?? '物业收费系统'}</span>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
