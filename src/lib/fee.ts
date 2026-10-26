// EXPORTS: calcFee, electricTierOf, toCNNumber, formatMoney, currentPeriod, periodLabel, uid

import type { ICommunity, ISettings } from '@/data/types';

/** 单条收费计算结果 */
export interface IFeeResult {
  waterUsage: number;
  electricUsage: number;
  waterAmount: number;
  electricAmount: number;
  /** 线路维护费（元），按当月用电量 × 小区线路维护费单价 */
  lineAmount: number;
  /** 电费所在阶梯，如 第一阶梯（未启用阶梯的小区返回空串） */
  electricTier: string;
  /** 合计 = 水费 + 电费 + 线路维护费 + 物业费 + 垃圾处理费 + 自定义款项 */
  totalAmount: number;
  // v1.3.0
  waterLoss: number;
  electricLoss: number;
  customUsage: number;
  customLoss: number;
  customAmount: number;
  /** 三个自定义款项金额合计 */
  itemsTotal: number;
}

/** 按年度累计用电量判断所在阶梯与单价 */
export function electricTierOf(
  yearUsage: number,
  s: ISettings,
): { tier: 1 | 2 | 3; price: number; label: string } {
  if (yearUsage <= s.electricTier1Limit) {
    return { tier: 1, price: s.electricTier1Price, label: '第一阶梯' };
  }
  if (yearUsage <= s.electricTier2Limit) {
    return { tier: 2, price: s.electricTier2Price, label: '第二阶梯' };
  }
  return { tier: 3, price: s.electricTier3Price, label: '第三阶梯' };
}

/** v1.3.0 抄表计算扩展参数：损耗率与自定义项 */
export interface ICalcFeeOpts {
  /** 水损耗率（小数，如 0.05 = 5%），缺省 0 */
  waterLossRate?: number;
  /** 电损耗率（小数），缺省 0 */
  electricLossRate?: number;
  /** 手改水损耗量（覆盖按损耗率自动计算） */
  waterLoss?: number;
  /** 手改电损耗量（覆盖按损耗率自动计算） */
  electricLoss?: number;
  /** 自定义抄表行读数与单价 */
  customPrev?: number;
  customCurr?: number;
  customPrice?: number;
  /** 自定义抄表行损耗率（小数），缺省 0 */
  customLossRate?: number;
  /** 手改自定义行损耗量（覆盖自动计算） */
  customLoss?: number;
  /** 三个自定义款项金额 */
  item1Amount?: number;
  item2Amount?: number;
  item3Amount?: number;
}

/**
 * 计算本期费用。
 * @param yearElectricUsage 年度累计用电量（含本月，用于判断阶梯）
 * @param propertyFee 该户物业费
 * @param community 业主所属小区（水价/垃圾费/固定电价/线路维护费/阶梯开关按小区配置；缺省用全局默认）
 * @param opts v1.3.0 损耗率与自定义抄表行/自定义款项
 */
export function calcFee(
  waterPrev: number,
  waterCurr: number,
  electricPrev: number,
  electricCurr: number,
  yearElectricUsage: number,
  settings: ISettings,
  propertyFee: number,
  community?: ICommunity,
  garbageFeeOverride?: number,
  opts?: ICalcFeeOpts,
): IFeeResult {
  const waterUsage = Math.max(0, waterCurr - waterPrev);
  const electricUsage = Math.max(0, electricCurr - electricPrev);
  const waterPrice = community?.waterPrice ?? settings.waterPrice;
  const garbageFee =
    garbageFeeOverride ?? community?.garbageFee ?? settings.garbageFee;
  // v1.3.0：损耗量 = 抄见数 × 损耗率（支持手改覆盖）；金额按 抄见数+损耗 计
  const waterLossRate = opts?.waterLossRate ?? community?.waterLossRate ?? 0;
  const electricLossRate = opts?.electricLossRate ?? community?.electricLossRate ?? 0;
  const waterLoss = round2(opts?.waterLoss ?? waterUsage * waterLossRate);
  const electricLoss = round2(opts?.electricLoss ?? electricUsage * electricLossRate);
  const waterAmount = round2((waterUsage + waterLoss) * waterPrice);
  // 电价：小区启用阶梯 -> 按全局阶梯单价；否则按小区固定电价（缺省取全局第一档）
  const hasTier = community?.hasTier ?? true;
  const tier = hasTier
    ? electricTierOf(yearElectricUsage, settings)
    : { tier: 1 as const, price: community?.electricPrice ?? settings.electricTier1Price, label: '' };
  const electricAmount = round2((electricUsage + electricLoss) * tier.price);
  // 线路维护费：按当月用电量（不含损耗）× 小区线路维护费单价
  const lineAmount = round2(electricUsage * (community?.lineFee ?? 0));
  // v1.3.0 自定义抄表行：金额 = (抄见数+损耗) × 单价
  const customUsage = Math.max(0, (opts?.customCurr ?? 0) - (opts?.customPrev ?? 0));
  const customLoss = round2(opts?.customLoss ?? customUsage * (opts?.customLossRate ?? 0));
  const customAmount = round2((customUsage + customLoss) * (opts?.customPrice ?? 0));
  // v1.3.0 三个自定义款项（金额直接输入）
  const itemsTotal = round2(
    (opts?.item1Amount ?? 0) + (opts?.item2Amount ?? 0) + (opts?.item3Amount ?? 0),
  );
  const totalAmount = round2(
    waterAmount + electricAmount + lineAmount + propertyFee + garbageFee + customAmount + itemsTotal,
  );
  return {
    waterUsage,
    electricUsage,
    waterAmount,
    electricAmount,
    lineAmount,
    electricTier: tier.label,
    totalAmount,
    waterLoss,
    electricLoss,
    customUsage,
    customLoss,
    customAmount,
    itemsTotal,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 金额格式化：1234.5 -> 1,234.50 */
export function formatMoney(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 人民币金额大写（支持到亿） */
export function toCNNumber(amount: number): string {
  if (amount < 0 || !Number.isFinite(amount)) return '';
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '万', '亿'];

  const intPart = Math.floor(amount);
  const frac = Math.round((amount - intPart) * 100);
  const jiao = Math.floor(frac / 10);
  const fen = frac % 10;

  let intStr = '';
  if (intPart === 0) {
    intStr = '零';
  } else {
    let n = intPart;
    let group = 0;
    const parts: string[] = [];
    while (n > 0) {
      let g = n % 10000;
      const gDigits: string[] = [];
      let zeroFlag = false;
      let pos = 0;
      while (g > 0 || pos < 4) {
        const d = g % 10;
        if (d === 0) {
          if (gDigits.length > 0) zeroFlag = true;
        } else {
          if (zeroFlag && gDigits.length > 0) gDigits.push('零');
          gDigits.push(digits[d] + units[pos]);
          zeroFlag = false;
        }
        g = Math.floor(g / 10);
        pos += 1;
      }
      let gStr = gDigits.reverse().join('');
      if (gStr && group > 0) gStr += bigUnits[group];
      parts.push(gStr);
      group += 1;
      n = Math.floor(n / 10000);
    }
    intStr = parts.reverse().join('');
    if (!intStr) intStr = '零';
  }

  let result = `${intStr}元`;
  if (jiao === 0 && fen === 0) {
    result += '整';
  } else {
    if (jiao > 0) result += `${digits[jiao]}角`;
    if (fen > 0) result += `${digits[fen]}分`;
    if (jiao === 0 && fen > 0) result = `${intStr}元零${digits[fen]}分`;
  }
  return result;
}

/** 当前期次：2026-09 */
export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 期次显示：2026-09 -> 2026年09月 */
export function periodLabel(period: string): string {
  const [y, m] = period.split('-');
  return `${y}年${m}月`;
}

/** 简单唯一 id */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
