import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { IOwner, IReading, ISettings, ISyncState } from '@/data/types';

export interface IAppStore {
  owners: IOwner[];
  readings: IReading[];
  settings: ISettings;
  setOwners: Dispatch<SetStateAction<IOwner[]>>;
  setReadings: Dispatch<SetStateAction<IReading[]>>;
  setSettings: Dispatch<SetStateAction<ISettings>>;
  loading: boolean;
  /** 数据同步状态（自动同步 + 手动操作写回共用） */
  syncState: ISyncState;
  /** 校准后的服务器当前时间（本地每秒推进） */
  serverNow: Date | null;
}

export const StoreContext = createContext<IAppStore | null>(null);

export function useAppStore(): IAppStore {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useAppStore 必须在 AppStoreProvider 内使用');
  return ctx;
}
