import { useEffect } from 'react';
import type { IPrintPaper } from '@/data/types';

/**
 * 把打印参数里的纸张尺寸写成精确的 @page 规则。
 *
 * 为什么要动态注入：CSS 自定义属性不能用在 `@page` 的 `size` 描述符里，
 * 而写死 `size: 180mm 210mm` 又没法在界面上调纸。所以这里用 <style> 标签
 * 注入字面量，用户改一次纸参数就重写一次，浏览器打印时严格按该尺寸分页。
 */
export default function PrintPaperStyle({ paper }: { paper: IPrintPaper }) {
  useEffect(() => {
    const id = 'print-paper-page-rule';
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = `@page { size: ${paper.width}mm ${paper.height}mm; margin: 0; }`;
    return () => {
      // 离开打印中心时清掉，避免影响其它页面的打印
      el?.remove();
    };
  }, [paper.width, paper.height]);

  return null;
}
