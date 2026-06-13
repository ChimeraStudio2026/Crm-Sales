'use client';

import { useEffect, useRef, type RefObject } from 'react';

interface UseCrmTableHorizontalScrollParams {
  viewportRef: RefObject<HTMLElement | null>;
  tableRef: RefObject<HTMLElement | null>;
  barRef: RefObject<HTMLElement | null>;
  isActive: boolean;
}

export function useCrmTableHorizontalScroll({
  viewportRef,
  tableRef,
  barRef,
  isActive,
}: UseCrmTableHorizontalScrollParams): void {
  const dragStateRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!isActive) return;
    const viewport = viewportRef.current;
    const bar = barRef.current;
    const table = tableRef.current;
    if (!viewport || !bar) return;

    const inner = document.createElement('div');
    inner.className = 'table-h-scroll-inner';
    bar.appendChild(inner);

    const setScrollLeft = (nextScrollLeft: number): void => {
      const contentWidth = table
        ? Math.max(table.offsetWidth, table.scrollWidth)
        : viewport.scrollWidth;
      const maxScroll = Math.max(0, contentWidth - viewport.clientWidth);
      const clamped = Math.max(0, Math.min(maxScroll, nextScrollLeft));
      syncingRef.current = true;
      viewport.scrollLeft = clamped;
      bar.scrollLeft = clamped;
      syncingRef.current = false;
    };

    const syncWidths = (): void => {
      const contentWidth = table
        ? Math.max(table.offsetWidth, table.scrollWidth)
        : viewport.scrollWidth;
      inner.style.width = `${contentWidth}px`;
      bar.classList.add('is-visible');
      if (!syncingRef.current) {
        bar.scrollLeft = viewport.scrollLeft;
      }
    };

    const handleBarScroll = (): void => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      viewport.scrollLeft = bar.scrollLeft;
      syncingRef.current = false;
    };

    const handleViewportScroll = (): void => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      bar.scrollLeft = viewport.scrollLeft;
      syncingRef.current = false;
    };

    const handleBarMouseDown = (event: MouseEvent): void => {
      if (event.button !== 0) return;
      dragStateRef.current = {
        startX: event.clientX,
        startScrollLeft: bar.scrollLeft,
      };
      bar.classList.add('is-dragging');
      event.preventDefault();
    };

    const handleMouseMove = (event: MouseEvent): void => {
      if (!dragStateRef.current) return;
      const deltaX = event.clientX - dragStateRef.current.startX;
      setScrollLeft(dragStateRef.current.startScrollLeft + deltaX);
    };

    const handleMouseUp = (): void => {
      if (!dragStateRef.current) return;
      dragStateRef.current = null;
      bar.classList.remove('is-dragging');
    };

    const handleWheel = (event: WheelEvent): void => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) && !event.shiftKey) return;
      const delta = event.shiftKey ? event.deltaY : event.deltaX;
      if (delta === 0) return;
      setScrollLeft(viewport.scrollLeft + delta);
      event.preventDefault();
    };

    bar.addEventListener('scroll', handleBarScroll);
    viewport.addEventListener('scroll', handleViewportScroll);
    bar.addEventListener('mousedown', handleBarMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    viewport.addEventListener('wheel', handleWheel, { passive: false });

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => syncWidths())
      : null;
    resizeObserver?.observe(viewport);
    if (table) resizeObserver?.observe(table);
    window.addEventListener('resize', syncWidths);
    syncWidths();

    return () => {
      bar.removeEventListener('scroll', handleBarScroll);
      viewport.removeEventListener('scroll', handleViewportScroll);
      bar.removeEventListener('mousedown', handleBarMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      viewport.removeEventListener('wheel', handleWheel);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncWidths);
      inner.remove();
      bar.classList.remove('is-visible', 'is-dragging', 'is-active');
    };
  }, [barRef, isActive, tableRef, viewportRef]);
}
