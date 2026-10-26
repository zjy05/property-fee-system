import type { CSSProperties } from 'react';
import type { IPrintPaper } from '@/data/types';

/**
 * 票据纸张样式：宽/高/内边距都按打印参数来。
 * 关键点是 height 用固定纸高，配合 print.css 里的 `break-after: page`，
 * 做到「一张收据 = 一页 = 一个纸高」，三联连续纸的撕单线才对得齐。
 */
export function paperStyle(paper: IPrintPaper): CSSProperties {
  return {
    '--paper-width': paper.width + 'mm',
    '--paper-height': paper.height + 'mm',
    '--paper-padding':
      paper.marginTop + 'mm ' + paper.marginRight + 'mm ' + paper.marginBottom + 'mm ' + paper.marginLeft + 'mm',
    width: paper.width + 'mm',
    height: paper.height + 'mm',
    fontSize: paper.fontSize + 'px',
    lineHeight: paper.lineHeight,
    fontFamily: '"SimSun", "NSimSun", "宋体", serif',
  } as CSSProperties;
}

/** 单价：金额 ÷ 用量 反推（含损耗时更准）；无用量时回退到小区/全局单价 */
export function unitPrice(amount: number, usage: number, fallback: number): number {
  return usage > 0 ? amount / usage : fallback;
}
