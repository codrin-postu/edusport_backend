import * as React from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { cx } from './cx';
import { Button } from './Button';
import { ensureAdminUi } from './styles';

/**
 * General, short-lived feedback ("Modificările au fost salvate.", a save
 * error, a background warning) goes through here. `Notice` stays for
 * persistent, page-bound messages (a load error blocking a whole section,
 * a permanent hint) — it is not replaced by this.
 *
 * `adminToast` is a tiny module-level event emitter, not a React context: the
 * admin mounts different pages on different React roots (see EdusportShell,
 * SaveBar, MobileNav in app.tsx), so a provider would need to be re-mounted
 * in every one of them. Call `adminToast.success(...)` from anywhere —
 * inside a component, an event handler, or a plain async function — with no
 * provider required. `useToast()` is the same API as a hook, for callers
 * that prefer that shape; it does not change how toasts are stored or shown.
 *
 * `<ToastViewport />` is mounted exactly once for the whole admin (see
 * `mountToastViewport`, called from the app.tsx bootstrap next to
 * mountSaveBar / mountMobileNav / mountEdusportShell) and portals into
 * document.body, so it renders above every page regardless of which root
 * triggered the toast.
 */

export type ToastTone = 'success' | 'info' | 'warning' | 'danger';

export interface ToastOptions {
  /** Optional bold lead-in, above the message. */
  title?: React.ReactNode;
  /** Overrides the tone's default auto-dismiss delay (ms). danger ignores this and stays until closed. */
  duration?: number;
}

interface ToastItem {
  id: number;
  tone: ToastTone;
  text: React.ReactNode;
  title?: React.ReactNode;
  /** null = stays until the user closes it. */
  duration: number | null;
}

/** success/info: 5s. warning: 5s. danger: stays until closed. */
const DEFAULT_DURATION: Record<ToastTone, number | null> = {
  success: 5000,
  info: 5000,
  warning: 5000,
  danger: null,
};

/** At most this many toasts are shown at once; a new one pushes the oldest out. */
const MAX_VISIBLE = 3;

let seq = 0;
let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

function push(tone: ToastTone, text: React.ReactNode, opts?: ToastOptions): number {
  const id = ++seq;
  const duration = tone === 'danger' ? null : opts?.duration ?? DEFAULT_DURATION[tone];
  toasts = [...toasts, { id, tone, text, title: opts?.title, duration }].slice(-MAX_VISIBLE);
  emit();
  return id;
}

function dismiss(id: number): void {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

/** Usable from anywhere: a component, an event handler, a plain async function. No provider needed. */
export const adminToast = {
  success: (text: React.ReactNode, opts?: ToastOptions) => push('success', text, opts),
  info: (text: React.ReactNode, opts?: ToastOptions) => push('info', text, opts),
  warning: (text: React.ReactNode, opts?: ToastOptions) => push('warning', text, opts),
  /** Alias of `warning`, kept for older call sites. */
  warn: (text: React.ReactNode, opts?: ToastOptions) => push('warning', text, opts),
  error: (text: React.ReactNode, opts?: ToastOptions) => push('danger', text, opts),
  dismiss,
};

/** "Salvat" success toast, for the autosave pages (list/inbox pages, phase 2) that only need the one word. */
export function toastAutosaved(): number {
  return adminToast.success('Salvat');
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};
const getSnapshot = (): ToastItem[] => toasts;
const getServerSnapshot = (): ToastItem[] => [];

/** Same API as `adminToast`, exposed as a hook for callers that prefer that shape. */
export function useToast(): typeof adminToast {
  // Subscribing here only keeps a component that reads toast state (there is
  // none built in) in sync; adminToast itself needs no subscription to work.
  React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return adminToast;
}

const CLOSE_ICON = (
  <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

function ToastCard({ item }: { item: ToastItem }) {
  const [leaving, setLeaving] = React.useState(false);
  const remaining = React.useRef(item.duration);
  const startedAt = React.useRef<number | null>(null);
  const timer = React.useRef<number | null>(null);

  const clear = React.useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const close = React.useCallback(() => {
    clear();
    setLeaving(true);
    window.setTimeout(() => adminToast.dismiss(item.id), 160);
  }, [clear, item.id]);

  const arm = React.useCallback(() => {
    if (remaining.current === null) return;
    startedAt.current = Date.now();
    clear();
    timer.current = window.setTimeout(close, remaining.current);
  }, [clear, close]);

  React.useEffect(() => {
    arm();
    return clear;
  }, [arm, clear]);

  const pause = () => {
    if (remaining.current === null || startedAt.current === null) return;
    clear();
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    startedAt.current = null;
  };

  const urgent = item.tone === 'warning' || item.tone === 'danger';

  return (
    <div
      className={cx('ui-toast', `ui-toast--${item.tone}`, leaving && 'ui-toast--out')}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? undefined : 'polite'}
      onMouseEnter={urgent ? pause : undefined}
      onMouseLeave={urgent ? arm : undefined}
    >
      <div className="ui-toast-text">
        {item.title && <b className="ui-toast-title">{item.title}</b>}
        <span className="ui-toast-body">{item.text}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        icon={CLOSE_ICON}
        aria-label="Închide"
        className="ui-toast-close"
        onClick={close}
      />
    </div>
  );
}

/** The one viewport for the whole admin. Portals to document.body; mount it once via `mountToastViewport`. */
export function ToastViewport(): React.ReactPortal | null {
  React.useInsertionEffect(() => ensureAdminUi(), []);
  const list = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="ui-root ui-toast-viewport" aria-label="Notificări">
      {list.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>,
    document.body,
  );
}

const VIEWPORT_ROOT_ID = 'edusport-toast-root';

/**
 * Mount the single toast viewport for the whole admin, on its own body-level
 * root (like MobileNav/SaveBar/EdusportShell), so it renders outside Strapi's
 * providers and above whichever page is showing. Idempotent.
 */
export function mountToastViewport(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(VIEWPORT_ROOT_ID)) return;
  const root = document.createElement('div');
  root.id = VIEWPORT_ROOT_ID;
  document.body.appendChild(root);
  createRoot(root).render(<ToastViewport />);
}

export default adminToast;
