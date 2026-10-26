import type { IOwner, IReading, ISettings } from '@/data/types';
import { formatMoney, toCNNumber, periodLabel } from '@/lib/fee';
import { paperStyle, unitPrice } from './paperStyle';

interface Props {
  reading: IReading;
  owner: IOwner;
  settings: ISettings;
}

/**
 * 易达标准收据（7 列）：
 * 项目 | 本次抄见 | 上次抄见 | 抄见数 | 损耗 | 单价 | 金额
 * 行结构：水表·电表·物业费·垃圾处理费·线路维护费·自定义款项1-3
 */
export default function YidaReceipt({ reading, owner, settings }: Props) {
  const { paper } = settings;
  const community = settings.communities.find((c) => c.id === owner.communityId);
  const hasTier = community?.hasTier ?? true;
  const today = reading.paidDate ?? new Date().toISOString().slice(0, 10);
  const dateText = today.replace(/-/g, '/');

  const eleTotal = (reading.electricUsage ?? 0) + (reading.electricLoss ?? 0);
  const electricPrice = unitPrice(
    reading.electricAmount ?? 0,
    eleTotal,
    hasTier ? settings.electricTier1Price : (community?.electricPrice ?? settings.electricTier1Price),
  );
  const waterTotal = (reading.waterUsage ?? 0) + (reading.waterLoss ?? 0);
  const waterPrice = unitPrice(reading.waterAmount ?? 0, waterTotal, community?.waterPrice ?? settings.waterPrice);

  const paidAmount = reading.paidAmount ?? (reading.paid ? reading.totalAmount : 0);
  const lastBalance = reading.lastBalance ?? 0;
  const curBalance =
    reading.curBalance ?? Math.round((lastBalance + (reading.totalAmount ?? 0) - paidAmount) * 100) / 100;

  const customMeterName = community?.customMeterName || '自定义';
  const customName = reading.customName || customMeterName;

  const rows: { name: string; prev: string; curr: string; usage: string; loss: string; price: string; amount: number }[] = [
    {
      name: '水费',
      prev: String(reading.waterPrev ?? 0),
      curr: String(reading.waterCurr ?? 0),
      usage: String(reading.waterUsage ?? 0),
      loss: String(reading.waterLoss ?? 0),
      price: formatMoney(waterPrice),
      amount: reading.waterAmount ?? 0,
    },
    {
      name: '电费',
      prev: String(reading.electricPrev ?? 0),
      curr: String(reading.electricCurr ?? 0),
      usage: String(reading.electricUsage ?? 0),
      loss: String(reading.electricLoss ?? 0),
      price: formatMoney(electricPrice),
      amount: reading.electricAmount ?? 0,
    },
    { name: '物业费', prev: '', curr: '', usage: '', loss: '', price: '', amount: reading.propertyFee ?? 0 },
    { name: '垃圾处理费', prev: '', curr: '', usage: '', loss: '', price: '', amount: reading.garbageFee ?? 0 },
  ];

  if ((reading.customUsage ?? 0) > 0 || (reading.customAmount ?? 0) > 0 || (reading.customCurr ?? 0) > 0) {
    const customTotal = (reading.customUsage ?? 0) + (reading.customLoss ?? 0);
    rows.push({
      name: customName,
      prev: String(reading.customPrev ?? 0),
      curr: String(reading.customCurr ?? 0),
      usage: String(reading.customUsage ?? 0),
      loss: String(reading.customLoss ?? 0),
      price: formatMoney(unitPrice(reading.customAmount ?? 0, customTotal, reading.customPrice ?? 0)),
      amount: reading.customAmount ?? 0,
    });
  }
  if ((community?.lineFee ?? 0) > 0 || (reading.lineAmount ?? 0) > 0) {
    rows.push({
      name: '线路维护费',
      prev: '',
      curr: '',
      usage: reading.electricUsage > 0 ? String(reading.electricUsage) : '',
      loss: '',
      price: community?.lineFee ? formatMoney(community.lineFee) : '',
      amount: reading.lineAmount ?? 0,
    });
  }
  const items = [
    { name: reading.item1Name, amount: reading.item1Amount },
    { name: reading.item2Name, amount: reading.item2Amount },
    { name: reading.item3Name, amount: reading.item3Amount },
  ];
  for (const it of items) {
    if (it.name && String(it.name).trim() !== '') {
      rows.push({ name: String(it.name).trim(), prev: '', curr: '', usage: '', loss: '', price: '', amount: it.amount ?? 0 });
    }
  }

  const note =
    reading.note ??
    (hasTier
      ? '第一阶梯(0-' + settings.electricTier1Limit + ')*' + settings.electricTier1Price + '元/千瓦时 第二阶梯(' + (settings.electricTier1Limit + 1) + '-' + settings.electricTier2Limit + ')*' + settings.electricTier2Price + '元/千瓦时 第三阶梯' + settings.electricTier2Limit + '以上*' + settings.electricTier3Price + '元/千瓦时'
      : '固定电价 ' + (community?.electricPrice ?? settings.electricTier1Price) + ' 元/千瓦时' + (community?.lineFee ? ' · 线路维护费 ' + community.lineFee + ' 元/千瓦时' : ''));

  return (
    <div className="print-area receipt-paper mx-auto" style={paperStyle(paper)}>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: '24%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '15%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td colSpan={6} className="border border-black px-1 text-center font-bold">
              {settings.receiptTitle}
            </td>
            <td className="border border-black px-1 text-center">{dateText}</td>
          </tr>
          <tr>
            <td colSpan={4} className="border border-black px-1 text-center">
              户号:{reading.receiptNo || owner.roomNo}
            </td>
            <td colSpan={3} className="border border-black px-1 text-center">
              期次:{periodLabel(reading.period)}
            </td>
          </tr>
          <tr>
            <td colSpan={4} className="border border-black px-1 text-center">
              房号:{owner.roomNo}
            </td>
            <td colSpan={3} className="border border-black px-1 text-center">
              姓名:{owner.name}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-1 text-center font-bold">项目</td>
            <td className="border border-black px-1 text-center font-bold">本次抄见</td>
            <td className="border border-black px-1 text-center font-bold">上次抄见</td>
            <td className="border border-black px-1 text-center font-bold">抄见数</td>
            <td className="border border-black px-1 text-center font-bold">损耗</td>
            <td className="border border-black px-1 text-center font-bold">单价</td>
            <td className="border border-black px-1 text-center font-bold">金额/元</td>
          </tr>
          {rows.map((r, i) => (
            <tr key={r.name + '-' + i}>
              <td className="border border-black px-1 text-center">
                {i + 1}.{r.name}
              </td>
              <td className="border border-black px-1 text-center">{r.curr}</td>
              <td className="border border-black px-1 text-center">{r.prev}</td>
              <td className="border border-black px-1 text-center">{r.usage}</td>
              <td className="border border-black px-1 text-center">{r.loss}</td>
              <td className="border border-black px-1 text-center">{r.price}</td>
              <td className="border border-black px-1 text-center">{formatMoney(r.amount)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="border border-black px-1 text-center">
              应收金额:{formatMoney(reading.totalAmount)}
            </td>
            <td colSpan={4} className="border border-black px-1 text-center">
              实收金额:{formatMoney(paidAmount)}
            </td>
          </tr>
          <tr>
            <td colSpan={3} className="border border-black px-1 text-center">
              上次结余:{formatMoney(lastBalance)}
            </td>
            <td colSpan={4} className="border border-black px-1 text-center">
              本次结余:{formatMoney(curBalance)}
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-black px-1 text-center">
              合计(大写)
            </td>
            <td colSpan={5} className="border border-black px-1 text-center font-bold">
              {toCNNumber(reading.totalAmount)}
            </td>
          </tr>
          <tr>
            <td colSpan={3} className="border border-black px-1 text-center">
              收费人:{reading.receiver ?? ''}
            </td>
            <td colSpan={4} className="border border-black px-1 text-center">
              抄表人:{reading.reader ?? ''}
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-black px-1 text-center">
              备注
            </td>
            <td colSpan={5} className="border border-black px-1 text-center">{note}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
