export type PermissionKey =
  | 'dashboard'
  | 'community'
  | 'company'
  | 'owners'
  | 'analysis'
  | 'summary'
  | 'payments'
  | 'arrears'
  | 'print'
  | 'staff'
  | 'loginLogs'
  | 'settings';

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  group: string;
  description: string;
  /** 只属于管理员，不能在员工账号上勾选 */
  adminOnly?: boolean;
}

/** 页面级权限清单；顺序也决定员工登录后的默认落地页顺序 */
export const PERMISSIONS: PermissionDef[] = [
  { key: 'dashboard', label: '平台数据', group: '平台', description: '首页汇总、趋势和快捷入口' },
  { key: 'community', label: '小区信息', group: '数据', description: '小区、楼栋和收费参数（只读）' },
  { key: 'company', label: '物业信息', group: '数据', description: '公司资料与收据抬头（只读）' },
  { key: 'owners', label: '业主档案', group: '资产', description: '业主、房号、电话和表号（只读）' },
  { key: 'analysis', label: '运营分析', group: '台账', description: '应收、实收、收缴率和趋势' },
  { key: 'summary', label: '小区费用汇总', group: '台账', description: '按账期查看收费台账（只读）' },
  { key: 'payments', label: '缴费记录', group: '台账', description: '已收款记录和缴费日期' },
  { key: 'arrears', label: '小区欠费', group: '台账', description: '未收款记录和欠费金额' },
  { key: 'print', label: '打印中心', group: '打印', description: '预览、浏览器打印和针式直打' },
  { key: 'staff', label: '物业员工', group: '管理', description: '添加账号、分配权限、删除账号', adminOnly: true },
  { key: 'loginLogs', label: '登录日志', group: '管理', description: '登录成功/失败记录', adminOnly: true },
  { key: 'settings', label: '设置', group: '管理', description: '收费参数、小区管理、数据备份', adminOnly: true },
];

export const ASSIGNABLE_PERMISSIONS = PERMISSIONS.filter((p) => !p.adminOnly);

export const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

const ASSIGNABLE_SET = new Set<string>(ASSIGNABLE_PERMISSIONS.map((p) => p.key));

export const PERMISSION_PATHS: Record<PermissionKey, string> = {
  dashboard: '/',
  community: '/data/community',
  company: '/data/company',
  owners: '/assets/owners',
  analysis: '/ledger/analysis',
  summary: '/ledger/summary',
  payments: '/ledger/payments',
  arrears: '/ledger/arrears',
  print: '/print',
  staff: '/data/staff',
  loginLogs: '/login-logs',
  settings: '/settings',
};

/** 员工登录后的落地页顺序：先看汇总，再看台账，最后打印 */
const LANDING_ORDER: PermissionKey[] = [
  'dashboard',
  'summary',
  'analysis',
  'payments',
  'arrears',
  'owners',
  'print',
  'community',
  'company',
];

export interface AuthUserLike {
  role?: string;
  permissions?: unknown;
}

export function isAdmin(user: AuthUserLike | null | undefined): boolean {
  return user?.role === 'admin';
}

export function normalizePermissions(value: unknown): PermissionKey[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is PermissionKey => typeof v === 'string' && ASSIGNABLE_SET.has(v)))];
}

export function canAccess(user: AuthUserLike | null | undefined, key: PermissionKey): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return normalizePermissions(user.permissions).includes(key);
}

export function landingPath(user: AuthUserLike | null | undefined): string {
  if (isAdmin(user)) return '/';
  const first = LANDING_ORDER.find((key) => canAccess(user, key));
  return first ? PERMISSION_PATHS[first] : '/account';
}

export function permissionLabel(key: string): string {
  return PERMISSIONS.find((p) => p.key === key)?.label ?? key;
}
