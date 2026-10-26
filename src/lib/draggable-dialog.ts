import { useEffect } from 'react';

export function useDraggableDialog() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null;
      if (!dialog) return;
      const header = dialog.querySelector('[data-slot="dialog-header"]') as HTMLElement | null;
      if (!header) return;
      if (!(e.target as HTMLElement).closest('[data-slot="dialog-header"]')) return;
      if ((e.target as HTMLElement).closest('input, textarea, button, select, a')) return;

      const rect = dialog.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const origLeft = rect.left;
      const origTop = rect.top;

      dialog.style.margin = '0';
      dialog.style.transform = 'none';

      const onMove = (ev: MouseEvent) => {
        dialog.style.position = 'fixed';
        dialog.style.left = `${origLeft + ev.clientX - startX}px`;
        dialog.style.top = `${origTop + ev.clientY - startY}px`;
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
}
