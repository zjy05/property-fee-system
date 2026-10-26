import type { IOwner, IReading, ISettings } from '@/data/types';
import { formatMoney, toCNNumber } from '@/lib/fee';
import { paperStyle, unitPrice } from './paperStyle';

interface Props {
  reading: IReading;
  owner: IOwner;
  settings: ISettings;
}

/** 把 2026-10-01 / ISO 串格式化成 2026.10.1（与现有 Excel 的日期写法一致） */
function dotDate(raw?: string): string {
  const s = (raw || new Date().toISOString()).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return s.replace(/-/g, '.');
  return m[1] + '.' + Number(m[2]) + '.' + Number(m[3]);
}

/**
 * 演示二期收据（对齐业主现在在用的 Excel「演示二期二期.xlsx」Sheet1）：
 *
 *   收款收据
 *   楼层 | A301      | 姓名 | 张三 | 2026.10.1
 *   项目 | 上次指数 | 本次指数 | 度数 | 单价 | 金额
 *   电费 | 0.65 元/度
 *   水费 | 2.6  元/吨
 *   物业费
 *   增压费
 *   生活垃圾处置费
 *   应收金额 |        实收金额 | 合计
 *   合计(大写)
 *
 * 每一项只占一行；物业费/增压费/生活垃圾处置费没有抄表读数，只有金额。
 */
export default function HengjiReceipt({ reading, owner, settings }: Props) {
  const { paper } = settings;
  const community = settings.communities.find((c) => c.id === owner.communityId);
  const hasTier = community?.hasTier ?? true;

  const eleUsage = reading.electricUsage ?? 0;
  // 演示二期的「线路维护费」不单列，而是并进电费单价（0.568 电价 + 0.082 线路费 = 0.65，
  // 与业主 Excel 里的电费单价 0.65 完全一致）。所以这里把 lineAmount 合进电费金额。
  const eleAmount = (reading.electricAmount ?? 0) + (reading.lineAmount ?? 0);
  const eleFallbackPrice =
    (hasTier ? settings.electricTier1Price : (community?.electricPrice ?? settings.electricTier1Price)) +
    (community?.lineFee ?? 0);
  const electricPrice = unitPrice(eleAmount, eleUsage, eleFallbackPrice);
  const waterUsage = reading.waterUsage ?? 0;
  const waterPrice = unitPrice(reading.waterAmount ?? 0, waterUsage, community?.waterPrice ?? settings.waterPrice);

  const paidAmount = reading.paidAmount ?? (reading.paid ? reading.totalAmount : 0);
  const total = reading.totalAmount ?? 0;

  // 增压费：优先取名称含「增压」的自定义款项，找不到就退回款项1
  const items = [
    { name: reading.item1Name, amount: reading.item1Amount },
    { name: reading.item2Name, amount: reading.item2Amount },
    { name: reading.item3Name, amount: reading.item3Amount },
  ];
  const boost =
    items.find((it) => it.name && String(it.name).includes('增压')) ??
    { name: reading.item1Name, amount: reading.item1Amount };
  const boostName = (boost.name && String(boost.name).trim()) || '增压费';
  const boostAmount = boost.amount ?? 0;

  const td = 'border border-black px-1 text-center';
  const th = td + ' font-bold';

  return (
    <div className="print-area receipt-paper mx-auto" style={paperStyle(paper)}>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: '20%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '20%' }} />
        </colgroup>
        <tbody>
          {/* 标题 */}
          <tr>
            <td colSpan={6} className="border border-black px-1 py-0.5 text-center text-base font-bold">
              {settings.receiptTitle}
            </td>
          </tr>
          {/* 楼层 + 房号 + 姓名 + 日期 */}
          <tr>
            <td className={td}>楼层</td>
            <td colSpan={2} className={td}>
              {owner.roomNo}
            </td>
            <td className={td}>姓名</td>
            <td className={td}>{owner.name}</td>
            <td className={td}>{dotDate(reading.paidDate || reading.createdAt)}</td>
          </tr>
          {/* 六列表头 */}
          <tr>
            <td className={th}>项目</td>
            <td className={th}>上次指数</td>
            <td className={th}>本次指数</td>
            <td className={th}>度数</td>
            <td className={th}>单价</td>
            <td className={th}>金额</td>
          </tr>
          {/* 电费 */}
          <tr>
            <td className={td}>电费</td>
            <td className={td}>{reading.electricPrev ?? ''}</td>
            <td className={td}>{reading.electricCurr ?? ''}</td>
            <td className={td}>{eleUsage || ''}</td>
            <td className={td}>{formatMoney(electricPrice)}</td>
            <td className={td}>{formatMoney(eleAmount)}</td>
          </tr>
          {/* 水费 */}
          <tr>
            <td className={td}>水费</td>
            <td className={td}>{reading.waterPrev ?? ''}</td>
            <td className={td}>{reading.waterCurr ?? ''}</td>
            <td className={td}>{waterUsage || ''}</td>
            <td className={td}>{formatMoney(waterPrice)}</td>
            <td className={td}>{formatMoney(reading.waterAmount ?? 0)}</td>
          </tr>
          {/* 物业费 / 增压费 / 生活垃圾处置费：只有金额 */}
          {[
            { name: '物业费', amount: reading.propertyFee ?? 0 },
            { name: boostName, amount: boostAmount },
            { name: '生活垃圾处置费', amount: reading.garbageFee ?? 0 },
          ].map((row) => (
            <tr key={row.name}>
              <td className={td}>{row.name}</td>
              <td colSpan={4} className={td} />
              <td className={td}>{formatMoney(row.amount)}</td>
            </tr>
          ))}
          {/* 应收 / 实收 */}
          <tr>
            <td colSpan={4} className={td}>
              应收金额：{formatMoney(total)}
            </td>
            <td className={td}>实收金额</td>
            <td className={td}>{formatMoney(paidAmount)}</td>
          </tr>
          {/* 合计大写 */}
          <tr>
            <td colSpan={2} className={td}>
              合计(大写)
            </td>
            <td colSpan={4} className={td + ' text-left font-bold'}>
              {toCNNumber(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
