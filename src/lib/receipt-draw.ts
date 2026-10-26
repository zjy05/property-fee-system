import type { IOwner, IReading, ISettings } from '@/data/types';
import { formatMoney, toCNNumber } from '@/lib/fee';
import type { DrawOp, PrintJob } from '@/lib/print-agent';

/**
 * 把一张收据换算成「毫米坐标绘制指令」，交给本地打印助手直接送针式打印机。
 *
 * 版式与 templates/HengjiReceipt.tsx 保持一致（同一套列宽比例、同样的行结构），
 * 改版式时两处要一起改。
 */

/** 六列宽度比例（与 HengjiReceipt.tsx 的 colgroup 一致） */
const COL_RATIO = [20, 16, 16, 14, 14, 20];
/** 八列宽度比例（与 LaolouReceipt.tsx 的 colgroup 一致） */
const COL_RATIO_LAOLOU = [7.7, 8.4, 13.7, 13.1, 12.8, 13.2, 15.7, 15.4];

interface Cell {
  text: string;
  span?: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  /** 单格字号覆盖（缺省用整表字号） */
  size?: number;
}
interface Row {
  cells: Cell[];
  h: number;
}

function buildTable(x0: number, y0: number, colWidths: number[], rows: Row[], fontSize: number): DrawOp[] {
  const ops: DrawOp[] = [];
  let y = y0;
  for (const row of rows) {
    let x = x0;
    let ci = 0;
    for (const cell of row.cells) {
      const span = cell.span ?? 1;
      let w = 0;
      for (let k = 0; k < span; k++) w += colWidths[ci + k] ?? 0;
      ops.push({ t: 'rect', x, y, w, h: row.h });
      if (cell.text !== '') {
        ops.push({
          t: 'text',
          x: x + 1,
          y,
          w: Math.max(1, w - 2),
          h: row.h,
          text: cell.text,
          size: cell.size ?? fontSize,
          bold: cell.bold,
          align: cell.align ?? 'center',
        });
      }
      x += w;
      ci += span;
    }
    y += row.h;
  }
  return ops;
}

/**
 * 表格在纸张「内容区」内居中：
 * - 横向：内容区左右边距之间居中（默认左右边距相同 = 纸张居中）
 * - 纵向：内容区上下边距之间居中（默认上下相同 = 纸张居中）
 * 直接打印和屏幕/浏览器打印共用同一套位置逻辑。
 */
function buildCenteredTable(
  paper: { width: number; height: number; marginTop: number; marginBottom: number; marginLeft: number; marginRight: number },
  colWidths: number[],
  rows: Row[],
  fontSize: number,
): DrawOp[] {
  const tableW = colWidths.reduce((sum, w) => sum + w, 0);
  const tableH = rows.reduce((sum, row) => sum + row.h, 0);
  const contentW = Math.max(0, paper.width - paper.marginLeft - paper.marginRight);
  const contentH = Math.max(0, paper.height - paper.marginTop - paper.marginBottom);
  const x0 = paper.marginLeft + Math.max(0, (contentW - tableW) / 2);
  const y0 = paper.marginTop + Math.max(0, (contentH - tableH) / 2);
  return buildTable(x0, y0, colWidths, rows, fontSize);
}

/** 2026-10-01 -> 2026.10.1 */
function dotDate(raw?: string): string {
  const s = (raw || new Date().toISOString()).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return s.replace(/-/g, '.');
  return m[1] + '.' + Number(m[2]) + '.' + Number(m[3]);
}

/** 演示二期版式的绘制指令 */
export function buildHengjiJob(reading: IReading, owner: IOwner, settings: ISettings): PrintJob {
  const paper = settings.paper;
  const community = settings.communities.find((c) => c.id === owner.communityId);
  const hasTier = community?.hasTier ?? true;

  const eleUsage = reading.electricUsage ?? 0;
  // 线路维护费并入电费单价（与 Excel 里 0.65 的口径一致）
  const eleAmount = (reading.electricAmount ?? 0) + (reading.lineAmount ?? 0);
  const eleFallback =
    (hasTier ? settings.electricTier1Price : (community?.electricPrice ?? settings.electricTier1Price)) +
    (community?.lineFee ?? 0);
  const elePrice = eleUsage > 0 ? eleAmount / eleUsage : eleFallback;

  const waterUsage = reading.waterUsage ?? 0;
  const waterAmount = reading.waterAmount ?? 0;
  const waterPrice = waterUsage > 0 ? waterAmount / waterUsage : (community?.waterPrice ?? settings.waterPrice);

  const paidAmount = reading.paidAmount ?? (reading.paid ? reading.totalAmount : 0);
  const total = reading.totalAmount ?? 0;

  const items = [
    { name: reading.item1Name, amount: reading.item1Amount },
    { name: reading.item2Name, amount: reading.item2Amount },
    { name: reading.item3Name, amount: reading.item3Amount },
  ];
  const boost = items.find((it) => it.name && String(it.name).includes('增压')) ?? {
    name: reading.item1Name,
    amount: reading.item1Amount,
  };
  const boostName = (boost.name && String(boost.name).trim()) || '增压费';

  // 内容区宽度按纸张减边距算
  const contentW = Math.max(40, paper.width - paper.marginLeft - paper.marginRight);
  const colWidths = COL_RATIO.map((r) => (contentW * r) / 100);

  const fs = 9;
  const rowH = 6;
  const rows: Row[] = [
    { h: 8, cells: [{ text: settings.receiptTitle, span: 6, bold: true }] },
    {
      h: rowH,
      cells: [
        { text: '楼层' },
        { text: owner.roomNo, span: 2 },
        { text: '姓名' },
        { text: owner.name },
        { text: dotDate(reading.paidDate || reading.createdAt) },
      ],
    },
    {
      h: rowH,
      cells: [
        { text: '项目', bold: true },
        { text: '上次指数', bold: true },
        { text: '本次指数', bold: true },
        { text: '度数', bold: true },
        { text: '单价', bold: true },
        { text: '金额', bold: true },
      ],
    },
    {
      h: rowH,
      cells: [
        { text: '电费' },
        { text: String(reading.electricPrev ?? '') },
        { text: String(reading.electricCurr ?? '') },
        { text: eleUsage ? String(eleUsage) : '' },
        { text: formatMoney(elePrice) },
        { text: formatMoney(eleAmount) },
      ],
    },
    {
      h: rowH,
      cells: [
        { text: '水费' },
        { text: String(reading.waterPrev ?? '') },
        { text: String(reading.waterCurr ?? '') },
        { text: waterUsage ? String(waterUsage) : '' },
        { text: formatMoney(waterPrice) },
        { text: formatMoney(waterAmount) },
      ],
    },
    { h: rowH, cells: [{ text: '物业费' }, { text: '', span: 4 }, { text: formatMoney(reading.propertyFee ?? 0) }] },
    { h: rowH, cells: [{ text: boostName }, { text: '', span: 4 }, { text: formatMoney(boost.amount ?? 0) }] },
    {
      h: rowH,
      cells: [{ text: '生活垃圾处置费' }, { text: '', span: 4 }, { text: formatMoney(reading.garbageFee ?? 0) }],
    },
    {
      h: rowH,
      cells: [
        { text: '应收金额：' + formatMoney(total), span: 4 },
        { text: '实收金额' },
        { text: formatMoney(paidAmount) },
      ],
    },
    { h: 7, cells: [{ text: '合计(大写)', span: 2 }, { text: toCNNumber(total), span: 4, align: 'left' }] },
  ];

  const ops = buildCenteredTable(paper, colWidths, rows, fs);

  return {
    paper: { widthMm: paper.width, heightMm: paper.height },
    ops,
  };
}

/**
 * 演示小区阶梯版式的绘制指令。
 * 版式与 templates/LaolouReceipt.tsx 保持一致：8 列、年度合计、物业费/垃圾费同行。
 */
export function buildLaolouJob(
  reading: IReading,
  owner: IOwner,
  settings: ISettings,
  yearElectricUsage?: number,
  yearWaterUsage?: number,
): PrintJob {
  const paper = settings.paper;
  const community = settings.communities.find((c) => c.id === owner.communityId);
  const hasTier = community?.hasTier ?? true;

  const total = reading.totalAmount ?? 0;
  const paidAmount = reading.paidAmount ?? (reading.paid ? total : 0);
  const propertyFee = reading.propertyFee ?? 0;
  const garbageFee = reading.garbageFee ?? 0;
  const yearEle = yearElectricUsage ?? reading.yearElectricUsage ?? reading.electricUsage ?? 0;
  const yearWater = yearWaterUsage ?? reading.waterUsage ?? 0;

  const note =
    (reading.note && reading.note.trim()) ||
    (hasTier
      ? `第一阶梯(0-${settings.electricTier1Limit})*${settings.electricTier1Price}元/千瓦时  第二阶梯（${settings.electricTier1Limit + 1}-${settings.electricTier2Limit}）*${settings.electricTier2Price}元/千瓦时  第三阶梯${settings.electricTier2Limit}以上*${settings.electricTier3Price}元/千瓦时`
      : `固定电价 ${community?.electricPrice ?? settings.electricTier1Price} 元/千瓦时` +
        (community?.lineFee ? ` · 线路维护费 ${community.lineFee} 元/千瓦时` : ''));

  const contentW = Math.max(40, paper.width - paper.marginLeft - paper.marginRight);
  const colWidths = COL_RATIO_LAOLOU.map((r) => (contentW * r) / 100);
  const fs = 9;
  const rowH = 6;

  const rows: Row[] = [
    {
      h: 8,
      cells: [
        { text: settings.receiptTitle, span: 7, bold: true, size: 11 },
        { text: dotDate(reading.paidDate || reading.createdAt) },
      ],
    },
    {
      h: rowH,
      cells: [
        { text: '楼层', span: 2 },
        { text: owner.roomNo, span: 2 },
        { text: '姓名' },
        { text: owner.name, span: 3 },
      ],
    },
    {
      h: rowH,
      cells: [
        { text: '项目', span: 2, bold: true },
        { text: '内容明细', span: 4, bold: true },
        { text: '年度合计', bold: true },
        { text: '金额/元', bold: true },
      ],
    },
    {
      h: rowH,
      cells: [
        { text: '1' },
        { text: '电费' },
        { text: '上月' },
        { text: String(reading.electricPrev ?? '') },
        { text: '本月' },
        { text: String(reading.electricCurr ?? '') },
        { text: yearEle ? String(yearEle) : '' },
        { text: formatMoney(reading.electricAmount ?? 0) },
      ],
    },
    {
      h: rowH,
      cells: [
        { text: '2' },
        { text: '水费' },
        { text: '上月' },
        { text: String(reading.waterPrev ?? '') },
        { text: '本月' },
        { text: String(reading.waterCurr ?? '') },
        { text: yearWater ? String(yearWater) : '' },
        { text: formatMoney(reading.waterAmount ?? 0) },
      ],
    },
    {
      h: rowH,
      cells: [
        { text: '3' },
        { text: '物业费' },
        { text: formatMoney(propertyFee) },
        { text: '城市垃圾处理费', span: 2 },
        { text: formatMoney(garbageFee) },
        { text: '合计' },
        { text: formatMoney(propertyFee + garbageFee) },
      ],
    },
    {
      h: rowH,
      cells: [
        { text: '合计(大写)', span: 2 },
        { text: toCNNumber(total), span: 3, align: 'left' },
        { text: '小写' },
        { text: formatMoney(total), span: 2, bold: true },
      ],
    },
    {
      h: 8,
      cells: [
        { text: '备注说明', span: 2 },
        { text: note, span: 6, align: 'left', size: 7 },
      ],
    },
    {
      h: rowH,
      cells: [
        { text: '实收金额', span: 2 },
        { text: formatMoney(paidAmount), span: 2 },
        { text: '抄表人 / 收款人', span: 2 },
        {
          text: (reading.reader || '') + (reading.receiver ? ' / ' + reading.receiver : ''),
          span: 2,
        },
      ],
    },
  ];

  const ops = buildCenteredTable(paper, colWidths, rows, fs);
  return { paper: { widthMm: paper.width, heightMm: paper.height }, ops };
}

/** 按当前设置选择版式，生成打印任务；暂不支持的版式返回 null */
export function buildPrintJob(
  reading: IReading,
  owner: IOwner,
  settings: ISettings,
  yearElectricUsage?: number,
  yearWaterUsage?: number,
): PrintJob | null {
  const tpl = settings.receiptTemplate ?? 'hengji';
  if (tpl === 'hengji') return buildHengjiJob(reading, owner, settings);
  if (tpl === 'laolou') return buildLaolouJob(reading, owner, settings, yearElectricUsage, yearWaterUsage);
  return null;
}
