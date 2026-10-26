import type { IOwner } from '@/data/types';

/**
 * 房号拆分规则：
 *   中楼东单元六楼东户 -> 楼栋=中楼，单元=东单元，房号=六楼东户
 *   北楼西单元三楼西户 -> 楼栋=北楼，单元=西单元，房号=三楼西户
 *   A301             -> 楼栋=传入的 building，单元=空，房号=A301
 */
export function splitRoomNo(roomNo: string, fallbackBuilding = ''): {
  building: string;
  unit: string;
  room: string;
} {
  const s = (roomNo || '').trim();
  const m = s.match(/^(.+?)([东西南北]单元)(.+)$/);
  if (m) {
    return {
      building: m[1].trim() || fallbackBuilding,
      unit: m[2].trim(),
      room: m[3].trim(),
    };
  }
  return { building: fallbackBuilding, unit: '', room: s };
}

/** 楼栋 + 单元 + 房号 -> 完整房号（打印/搜索用） */
export function joinRoomNo(building: string, unit: string, room: string): string {
  return `${building || ''}${unit || ''}${room || ''}`.trim();
}

/** 兼容旧数据：优先用拆分后的三段，缺失时回退 roomNo */
export function fullRoomNo(o: Pick<IOwner, 'building' | 'unit' | 'room' | 'roomNo'>): string {
  const joined = joinRoomNo(o.building || '', o.unit || '', o.room || '');
  return joined || o.roomNo || '';
}

/** 把一条旧业主补全楼栋/单元/房号（不改原对象） */
export function normalizeOwner(o: IOwner): IOwner {
  if (o.unit && o.room) return o;
  const parts = splitRoomNo(o.roomNo || '', o.building || '');
  return {
    ...o,
    building: o.building || parts.building,
    unit: o.unit || parts.unit,
    room: o.room || parts.room,
    roomNo: o.roomNo || joinRoomNo(parts.building, parts.unit, parts.room),
  };
}

/** 业主的显示地址：小区 / 楼栋 / 单元 / 房号 */
export function ownerAddress(o: IOwner, communityName?: string): string {
  const parts = [communityName, o.building, o.unit, o.room].filter(Boolean);
  return parts.join(' · ') || fullRoomNo(o);
}
