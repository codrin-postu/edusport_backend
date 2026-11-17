/**
 * Fast hover tooltip for every element with a `title` in the admin.
 * The native tooltip waits about a second and is easy to miss, so the title moves to `data-tip`
 * (the accessible name stays: aria-label is set from it when missing) and a small label shows after a short delay.
 */
const DELAY_MS = 250;
const GAP = 6;
let started = false;
let tip: HTMLDivElement | null = null;
let timer: number | undefined;
let current: HTMLElement | null = null;

function tipText(el: HTMLElement): string | null {
  const title = el.getAttribute('title');
  if (title) {
    el.setAttribute('data-tip', title);
    el.removeAttribute('title');
    if (!el.getAttribute('aria-label') && !el.textContent?.trim()) el.setAttribute('aria-label', title);
  }
  return el.getAttribute('data-tip');
}

function place(el: HTMLElement, text: string) {
  tip ??= Object.assign(document.createElement('div'), { className: 'ui-root ui-hovertip', role: 'tooltip' });
  if (!tip.isConnected) document.body.appendChild(tip);
  tip.textContent = text;
  const r = el.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  const above = r.top - t.height - GAP >= 0;
  const left = Math.min(Math.max(4, r.left + r.width / 2 - t.width / 2), window.innerWidth - t.width - 4);
  tip.style.left = `${left}px`;
  tip.style.top = `${above ? r.top - t.height - GAP : r.bottom + GAP}px`;
  tip.style.visibility = 'visible';
}

function hide() {
  window.clearTimeout(timer);
  current = null;
  if (tip) tip.style.visibility = 'hidden';
}

function onOver(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return;
  const el = (e.target as Element | null)?.closest<HTMLElement>('[title],[data-tip]') ?? null;
  if (el === current) return;
  hide();
  const text = el ? tipText(el) : null;
  if (!el || !text) return;
  current = el;
  timer = window.setTimeout(() => place(el, text), DELAY_MS);
}

/** Scrolling moves the control: hide a shown tip, keep a pending one (panels fire scroll events while settling). */
function onScroll() {
  if (tip?.style.visibility === 'visible') hide();
}

/** Starts once; idempotent. */
export function startHoverTips(): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  document.addEventListener('pointerover', onOver);
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('scroll', onScroll, true);
  document.addEventListener('keydown', hide, true);
}
