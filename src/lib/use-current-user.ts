import { useEffect, useState } from 'react';
import { getCurrentUser, type AuthUser } from './auth';

/** 监听登录态变化，权限被管理员改动后路由/菜单能立即跟着刷新 */
export function useCurrentUser(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(() => getCurrentUser());

  useEffect(() => {
    const sync = () => setUser(getCurrentUser());
    window.addEventListener('auth-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('auth-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return user;
}
