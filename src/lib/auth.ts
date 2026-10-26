const TOKEN_KEY = 'property-fee-print:token';
const USER_KEY = 'property-fee-print:user';

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
  communityId?: string;
  permissions?: string[];
}

export function saveCurrentUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event('auth-changed'));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function isAuthed() {
  return !!getToken();
}

export function getCurrentUser(): AuthUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null') as AuthUser | null;
  } catch {
    return null;
  }
}

export async function login(username, password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '登录失败' }));
    throw new Error(err.error || '登录失败');
  }
  const data = await res.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  saveCurrentUser(data.user);
  return data.user as AuthUser;
}

export async function refreshCurrentUser(): Promise<AuthUser | null> {
  const res = await apiFetch('/api/me');
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.user) {
    saveCurrentUser(data.user);
    return data.user as AuthUser;
  }
  return null;
}

export async function logout() {
  try {
    await fetch('/api/logout', { headers: { Authorization: `Bearer ${getToken()}` } });
  } catch { /* ignore */ }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event('auth-changed'));
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // 登录态失效时一并清掉本地数据缓存，防止旧实例/旧数据残留在页面上
    localStorage.removeItem('property-fee-print:cache');
    if (!window.location.pathname.includes('/login')) window.location.href = '/login';
    throw new Error('未登录');
  }
  return res;
}
