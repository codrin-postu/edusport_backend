import * as React from 'react';
import type { TourStep } from '../../club/onboarding/flows';
import { needsMenuOpen } from '../../club/onboarding/machine';
import { anchorSelector } from '../../club/onboarding/role';
import type { Box } from '../../club/onboarding/placement';
import { spaNavigate } from '../dashboard/EdusportShell';
import { REVEAL_EVENT } from './progressStore';

const POLL_MS = 150;
/** An anchor that never shows up within this long is given up on: the card shows centered, without a highlight. */
const WAIT_CEILING_MS = 10000;

const sameBox = (a: Box | null, b: Box | null): boolean =>
  a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

function measure(anchor: string): Box | null {
  const el = document.querySelector<HTMLElement>(anchorSelector(anchor));
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** Opens the phone menu, or the railed sidebar with its groups, when the step needs them; closes the phone menu when it no longer does. */
function useMenuReveal(step: TourStep | null, phone: boolean): void {
  const opened = React.useRef(false);
  React.useEffect(() => {
    const open = !!step && (needsMenuOpen(step, phone) || (!phone && /^(row-|primii-pasi$|ghid$)/.test(step.anchor)));
    if (open || opened.current) window.dispatchEvent(new CustomEvent(REVEAL_EVENT, { detail: { open, phone } }));
    opened.current = open;
  }, [step, phone]);
}

/**
 * The anchor's box, re-measured while the step is active (waits for an anchor that appears late, follows scroll,
 * resize and re-renders). Navigates to the step's page when it has one.
 */
export function useAnchor(step: TourStep | null, phone: boolean): Box | null {
  const [box, setBox] = React.useState<Box | null>(null);
  useMenuReveal(step, phone);
  React.useEffect(() => {
    setBox(null);
    if (!step) return undefined;
    if (step.path) spaNavigate(step.path);
    const started = Date.now();
    let found = false;
    const tick = () => {
      const next = measure(step.anchor);
      if (next) found = true;
      else if (!found && Date.now() - started > WAIT_CEILING_MS) window.clearInterval(timer);
      setBox((prev) => (sameBox(prev, next) ? prev : next));
    };
    const timer = window.setInterval(tick, POLL_MS);
    window.addEventListener('resize', tick);
    window.addEventListener('scroll', tick, true);
    tick();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', tick);
      window.removeEventListener('scroll', tick, true);
    };
  }, [step]);
  return box;
}
