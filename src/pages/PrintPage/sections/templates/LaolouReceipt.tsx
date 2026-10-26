import type { IOwner, IReading, ISettings } from '@/data/types';
import { formatMoney, toCNNumber } from '@/lib/fee';
import { paperStyle } from './paperStyle';

interface Props {
  reading: IReading;
  owner: IOwner;
  settings: ISettings;
  /** 年度累计用电量（Excel「月度引用-电费」B 列）；缺省用 reading.yearElectricUsage */
  yearElectricUsage?: number;
  /** 年度累计用水量（Excel「月度引用-水费」B 列）；缺省用当月用量 */
  yearWaterUsage?: number;
}

/** 2026-10-01 -> 2026.10.1（与 Excel 的日期写法一致） */
function dotDate(raw?: string): string {
  const s = (raw || new Date().toISOString()).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return s.replace(/-/g, '.');
  return m[1] + '.' + Number(m[2]) + '.' + Number(m[3]);
}

/**
 * 演示小区阶梯电费收据（对齐 `演示小区阶梯电费表.xlsx` 的「打印」页）：
 *
 *   收款收据                                  2026.10.1
 *   楼层 | 中楼... | 姓名 | 李四
 *   项目 | 内容明细 | 年度合计 | 金额/元
 *   1 | 电费 | 上月 | 10418 | 本月 | 10691 | 6224 | 135.80
 *   2 | 水费 | 上月 | 100     | 本月 | 108   | 120  | 20.80
 *   3 | 物业费 | 38 | 城市垃圾处理费 | 5 | 合计 | 43
 *   合计(大写) | 壹佰玖拾玖元陆角 | 小写 | 199.60
 *   备注说明 | 第一阶梯... 第二阶梯... 第三阶梯...
 *
 * 与「演示二期」版的区别：多了「年度合计」列，并把电/水拆成上月/本月两段；
 * 物业费与垃圾费在同一行，合计只算这两项，总合计在最后一行。
 */
export default function LaolouReceipt({
  reading,
  owner,
  settings,
  yearElectricUsage,
  yearWaterUsage,
}: Props) {
  const { paper } = settings;
  const community = settings.communities.find((c) => c.id === owner.communityId);
  const hasTier = community?.hasTier ?? true;

  const eleAmount = reading.electricAmount ?? 0;
  const waterAmount = reading.waterAmount ?? 0;
  const propertyFee = reading.propertyFee ?? 0;
  const garbageFee = reading.garbageFee ?? 0;
  const total = reading.totalAmount ?? 0;
  const paidAmount = reading.paidAmount ?? (reading.paid ? total : 0);

  const yearEle = yearElectricUsage ?? reading.yearElectricUsage ?? reading.electricUsage ?? 0;
  const yearWater = yearWaterUsage ?? reading.waterUsage ?? 0;

  const td = 'border border-black px-0.5 text-center align-middle';
  // 用 em 跟随「打印参数 → 字号」，这样业主在设置里调字号时整张票一起变
  const label = td + ' text-[0.9em] leading-tight';
  const value = td + ' text-[1em] leading-tight';
  const th = label + ' font-bold';

  const note =
    (reading.note && reading.note.trim()) ||
    (hasTier
      ? `第一阶梯(0-${settings.electricTier1Limit})*${settings.electricTier1Price}元/千瓦时  第二阶梯（${settings.electricTier1Limit + 1}-${settings.electricTier2Limit}）*${settings.electricTier2Price}元/千瓦时  第三阶梯${settings.electricTier2Limit}以上*${settings.electricTier3Price}元/千瓦时`
      : `固定电价 ${community?.electricPrice ?? settings.electricTier1Price} 元/千瓦时` +
        (community?.lineFee ? ` · 线路维护费 ${community.lineFee} 元/千瓦时` : ''));

  return (
    <div className="print-area receipt-paper mx-auto" style={paperStyle(paper)}>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: '7.7%' }} />
          <col style={{ width: '8.4%' }} />
          <col style={{ width: '13.7%' }} />
          <col style={{ width: '13.1%' }} />
          <col style={{ width: '12.8%' }} />
          <col style={{ width: '13.2%' }} />
          <col style={{ width: '15.7%' }} />
          <col style={{ width: '15.4%' }} />
        </colgroup>
        <tbody>
          {/* 标题 + 日期 */}
          <tr>
            <td colSpan={7} className={td + ' py-0.5 text-[1.25em] font-bold'}>
              {settings.receiptTitle}
            </td>
            <td className={value}>{dotDate(reading.paidDate || reading.createdAt)}</td>
          </tr>

          {/* 楼层 / 姓名 */}
          <tr>
            <td colSpan={2} className={label}>
              楼层
            </td>
            <td colSpan={2} className={value}>
              {owner.roomNo}
            </td>
            <td className={label}>姓名</td>
            <td colSpan={3} className={value}>
              {owner.name}
            </td>
          </tr>

          {/* 表头 */}
          <tr>
            <td colSpan={2} className={th}>
              项目
            </td>
            <td colSpan={4} className={th}>
              内容明细
            </td>
            <td className={th}>年度合计</td>
            <td className={th}>金额/元</td>
          </tr>

          {/* 电费 */}
          <tr>
            <td className={label}>1</td>
            <td className={label}>电费</td>
            <td className={label}>上月</td>
            <td className={value}>{reading.electricPrev ?? ''}</td>
            <td className={label}>本月</td>
            <td className={value}>{reading.electricCurr ?? ''}</td>
            <td className={value}>{yearEle || ''}</td>
            <td className={value}>{formatMoney(eleAmount)}</td>
          </tr>

          {/* 水费 */}
          <tr>
            <td className={label}>2</td>
            <td className={label}>水费</td>
            <td className={label}>上月</td>
            <td className={value}>{reading.waterPrev ?? ''}</td>
            <td className={label}>本月</td>
            <td className={value}>{reading.waterCurr ?? ''}</td>
            <td className={value}>{yearWater || ''}</td>
            <td className={value}>{formatMoney(waterAmount)}</td>
          </tr>

          {/* 物业费 + 垃圾费 + 小计 */}
          <tr>
            <td className={label}>3</td>
            <td className={label}>物业费</td>
            <td className={value}>{formatMoney(propertyFee)}</td>
            <td colSpan={2} className={label}>
              城市垃圾处理费
            </td>
            <td className={value}>{formatMoney(garbageFee)}</td>
            <td className={label}>合计</td>
            <td className={value}>{formatMoney(propertyFee + garbageFee)}</td>
          </tr>

          {/* 合计大写 + 小写 */}
          <tr>
            <td colSpan={2} className={label}>
              合计(大写)
            </td>
            <td colSpan={3} className={value + ' text-left'}>
              {toCNNumber(total)}
            </td>
            <td className={label}>小写</td>
            <td colSpan={2} className={value + ' font-bold'}>
              {formatMoney(total)}
            </td>
          </tr>

          {/* 备注 */}
          <tr>
            <td colSpan={2} className={label}>
              备注说明
            </td>
            <td colSpan={6} className={value + ' text-left text-[0.75em]'}>
              {note}
            </td>
          </tr>

          {/* 实收（Excel 没有，但收费场景需要；保留一行，方便收费员核对） */}
          <tr>
            <td colSpan={2} className={label}>
              实收金额
            </td>
            <td colSpan={2} className={value}>
              {formatMoney(paidAmount)}
            </td>
            <td colSpan={2} className={label}>
              抄表人 / 收款人
            </td>
            <td colSpan={2} className={value}>
              {(reading.reader || '') + (reading.receiver ? ' / ' + reading.receiver : '')}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
