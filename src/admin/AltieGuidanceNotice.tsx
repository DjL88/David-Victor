import React, { useEffect, useRef, useState } from 'react';
import type { AdminTab } from './AdminLayout';
import { getAltiePointerPosition, type AltiePointerPosition } from './altieGuidanceTarget';

export interface AltieGuidanceRequest {
  section: AdminTab;
  target?: string;
  label: string;
}

/** Presentation only: observes real controls; never clicks, prefills or saves. */
export const AltieGuidanceNotice: React.FC<{
  request: AltieGuidanceRequest;
  activeSection: AdminTab;
  onDismiss: () => void;
}> = ({ request, activeSection, onDismiss }) => {
  const [status, setStatus] = useState<'locating' | 'found' | 'unavailable'>('locating');
  const [position, setPosition] = useState<AltiePointerPosition | null>(null);
  const [showPointer, setShowPointer] = useState(true);
  const panelRef = useRef<HTMLElement>(null);
  const enteredSection = useRef(false);

  useEffect(() => {
    if (activeSection !== request.section) {
      if (enteredSection.current) onDismiss();
      return;
    }
    enteredSection.current = true;
    let disposed = false;
    let expired = false;
    let frame = 0;
    const scan = () => {
      frame = 0;
      if (disposed) return;
      const main = document.querySelector('main');
      // Exact attribute comparison: model-produced targets are never CSS syntax.
      const target = request.target && main
        ? Array.from(main.querySelectorAll<HTMLElement>('[data-admin-ai-target]'))
          .find((element) => element.getAttribute('data-admin-ai-target') === request.target)
        : undefined;
      const next = target && getComputedStyle(target).visibility !== 'hidden'
        ? getAltiePointerPosition(target.getBoundingClientRect(), window.innerWidth, window.innerHeight)
        : null;
      if (next) {
        setStatus('found');
        setPosition((previous) => previous?.x === next.x && previous?.y === next.y ? previous : next);
      } else {
        setPosition(null);
        setStatus(expired || !request.target ? 'unavailable' : 'locating');
      }
    };
    const scheduleScan = () => {
      if (!disposed && !frame) frame = window.requestAnimationFrame(scan);
    };
    // Following scrolling/layout is observation, not an assertion of task progress.
    const observer = new MutationObserver(scheduleScan);
    const main = document.querySelector('main');
    if (main) observer.observe(main, { subtree: true, childList: true, attributes: true });
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleScan);
    if (main) resizeObserver?.observe(main);
    window.addEventListener('scroll', scheduleScan, true);
    window.addEventListener('resize', scheduleScan);
    const timeout = window.setTimeout(() => { expired = true; scan(); }, 4000);
    scan();
    return () => {
      disposed = true;
      observer.disconnect();
      resizeObserver?.disconnect();
      window.clearTimeout(timeout);
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleScan, true);
      window.removeEventListener('resize', scheduleScan);
    };
  }, [activeSection, request, onDismiss]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || (event.target instanceof Node
        && !panelRef.current?.contains(event.target)
        && !['Shift', 'Control', 'Alt', 'Meta'].includes(event.key))) onDismiss();
    };
    // Taking over the page dismisses this first-destination pointer. The existing
    // stepper remains authoritative; we do not pretend to track its next steps.
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onDismiss]);

  if (activeSection !== request.section) return null;

  return <>
    <aside ref={panelRef} aria-label="Altie guidance" className="fixed right-3 top-3 z-[70] w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-indigo-200 bg-white p-4 text-slate-900 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-indigo-700">Altie · Guidance only</p>
          <p className="mt-1 break-words text-sm font-semibold">{request.label.slice(0, 160)}</p>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Dismiss Altie guidance" className="shrink-0 rounded px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2">Close</button>
      </div>
      <p role="status" aria-live="polite" className="mt-2 text-xs text-slate-600">
        {!request.target ? 'Review the settings on this page.'
          : status === 'locating' ? 'Looking for the requested control…'
          : status === 'found' ? 'The pointer marks the control to review.'
          : 'I cannot locate that control on this page. Please review the page manually.'}
      </p>
      <p className="mt-2 text-xs text-slate-600">Review any draft values before saving. This pointer does not click or save.</p>
      {position && <button type="button" aria-pressed={showPointer} onClick={() => setShowPointer((value) => !value)} className="mt-3 rounded border border-slate-200 px-2 py-1 text-xs focus-visible:outline focus-visible:outline-2">
        {showPointer ? 'Hide pointer' : 'Show pointer'}
      </button>}
    </aside>
    {showPointer && position && <div data-altie-guide-pointer aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[65] text-indigo-700 transition-transform duration-700 ease-out motion-reduce:transition-none" style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}>
      <svg width="28" height="32" viewBox="0 0 28 32" fill="none"><path d="M3 2L23 18L14 19L9 28L3 2Z" fill="currentColor" stroke="white" strokeWidth="2" strokeLinejoin="round" /></svg>
      <span className="ml-4 rounded bg-indigo-700 px-2 py-0.5 text-xs font-semibold text-white">Altie</span>
    </div>}
  </>;
};
