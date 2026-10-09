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
// by its exact text (e.g. open the drawer, then "New Character").
export const ClickSequence = ({ steps, children }: { steps: string[]; children: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timers = steps.map((label, i) => setTimeout(() => {
      const root = ref.current;
      if (!root) return;
      const el = root.querySelector<HTMLElement>(`[aria-label="${label}"]`)
        ?? Array.from(root.querySelectorAll<HTMLElement>('button')).find(b => b.textContent?.trim() === label);
      el?.click();
    }, i * 30));
    return () => timers.forEach(clearTimeout);
  }, [steps]);
  return <div ref={ref}>{children}</div>;
};

export const at = (minutesAgo: number) => ({ toDate: () => new Date(Date.now() - minutesAgo * 60000) });

export const noop = () => {};
