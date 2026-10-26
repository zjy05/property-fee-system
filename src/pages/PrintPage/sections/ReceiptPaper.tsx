import type { IOwner, IReading, ISettings } from '@/data/types';
import YidaReceipt from './templates/YidaReceipt';
import HengjiReceipt from './templates/HengjiReceipt';
import LaolouReceipt from './templates/LaolouReceipt';

interface ReceiptPaperProps {
  reading: IReading;
  owner: IOwner;
  settings: ISettings;
  /** 老楼版式用：年度累计用电/用水量（不传则组件内回退） */
  yearElectricUsage?: number;
  yearWaterUsage?: number;
}

/**
 * 收据模板调度器：
 * 打印中心可切换版式，具体版式实现放在 ./templates/ 下，互不影响。
 * - yida   ：易达标准收据（7 列，含损耗/结余/自定义款项）
 * - hengji ：演示二期收据（对齐「演示二期二期.xlsx」）
 * - laolou ：演示小区阶梯收据（对齐「演示小区阶梯电费表.xlsx」）
 */
export default function ReceiptPaper(props: ReceiptPaperProps) {
  const tpl = props.settings.receiptTemplate ?? 'hengji';
  if (tpl === 'yida') {
    return <YidaReceipt reading={props.reading} owner={props.owner} settings={props.settings} />;
  }
  if (tpl === 'laolou') {
    return (
      <LaolouReceipt
        reading={props.reading}
        owner={props.owner}
        settings={props.settings}
        yearElectricUsage={props.yearElectricUsage}
        yearWaterUsage={props.yearWaterUsage}
      />
    );
  }
  return <HengjiReceipt reading={props.reading} owner={props.owner} settings={props.settings} />;
}
