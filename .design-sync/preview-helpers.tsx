// Shared helpers for the authored previews in ./previews (not a component).
import { useEffect, useRef } from 'react';

// Fixed-position UI (drawers, modals, panels) renders inside this frame
// instead of escaping the card: a transform makes it the containing block.
export const Frame = ({ height = 640, children }: { height?: number; children: React.ReactNode }) => (
  <div style={{ height, transform: 'translateZ(0)', position: 'relative', overflow: 'hidden' }} className="bg-ink-950">
    {children}
  </div>
);

// Opens click-to-open UI for an "open" story by clicking the element with
// this aria-label once mounted.
export const ClickOnMount = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>(`[aria-label="${label}"]`)?.click(), 0);
    return () => clearTimeout(t);
  }, [label]);
  return <div ref={ref}>{children}</div>;
};

// Clicks a sequence of controls once mounted, each found by aria-label or
// by its exact text (e.g. open the drawer, then "New Character"). Each step
// waits (up to 2s) for its control to appear, e.g. after data loads.
export const ClickSequence = ({ steps, children }: { steps: string[]; children: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const find = (label: string) => {
      const root = ref.current;
      if (!root) return null;
      return root.querySelector<HTMLElement>(`[aria-label="${label}"]`)
        ?? Array.from(root.querySelectorAll<HTMLElement>('button')).find(b => b.textContent?.trim() === label) ?? null;
    };
    const run = (i: number, waited: number) => {
      if (cancelled || i >= steps.length) return;
      const el = find(steps[i]);
      if (el) { el.click(); timer = setTimeout(() => run(i + 1, 0), 30); }
      else if (waited < 2000) timer = setTimeout(() => run(i, waited + 50), 50);
    };
    timer = setTimeout(() => run(0, 0), 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [steps]);
  return <div ref={ref}>{children}</div>;
};

export const at = (minutesAgo: number) => {
  const ms = Date.now() - minutesAgo * 60000;
  return { toDate: () => new Date(ms), toMillis: () => ms };
};

export const noop = () => {};
