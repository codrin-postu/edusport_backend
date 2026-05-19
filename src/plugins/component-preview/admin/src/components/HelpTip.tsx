import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useTheme } from 'styled-components';
import { Information } from '@strapi/icons';
import type { StrapiTheme } from '@strapi/design-system';

export interface HelpTipProps {
  label: React.ReactNode;
  /** Square size in px for both the trigger icon and its hit area. Defaults to 20. */
  size?: number;
  /** Where the tooltip pops relative to the icon. Defaults to 'bottom-start'. */
  placement?: 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
  /** Optional aria-label override when `label` isn't a string. */
  ariaLabel?: string;
}

interface PopupPosition {
  top: number;
  left: number;
  transform: string;
  origin: string;
}

const NO_POS: PopupPosition = { top: 0, left: 0, transform: '', origin: '' };

/**
 * Inline help icon with a tooltip that works on hover, focus, and tap.
 * The Strapi DS Tooltip (Radix-backed) auto-dismisses on tap and renders inside
 * the parent stacking context - both make it unsuitable for an inline help affordance.
 * This component:
 *   - renders the popup via `createPortal` to document.body so it escapes any
 *     overflow:hidden / z-index parent and can never be visually obscured;
 *   - reads colors from the StrapiTheme so the dark background actually paints;
 *   - keeps "tap to read" behavior on touch (open state is fully controlled here).
 *
 * Reusable: `import { HelpTip } from './components/HelpTip'` from any editor.
 */
export function HelpTip({ label, size = 20, placement = 'bottom-start', ariaLabel }: HelpTipProps) {
  const theme = useTheme() as StrapiTheme;
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<PopupPosition>(NO_POS);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);

  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    switch (placement) {
      case 'top-start':
        setPos({
          top: rect.top - gap,
          left: rect.left,
          transform: 'translate(0, -100%)',
          origin: 'bottom left',
        });
        return;
      case 'top-end':
        setPos({
          top: rect.top - gap,
          left: rect.right,
          transform: 'translate(-100%, -100%)',
          origin: 'bottom right',
        });
        return;
      case 'bottom-end':
        setPos({
          top: rect.bottom + gap,
          left: rect.right,
          transform: 'translate(-100%, 0)',
          origin: 'top right',
        });
        return;
      case 'bottom-start':
      default:
        setPos({
          top: rect.bottom + gap,
          left: rect.left,
          transform: 'translate(0, 0)',
          origin: 'top left',
        });
    }
  }, [placement]);

  React.useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, updatePosition]);

  React.useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !popupRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const accessibleLabel =
    ariaLabel ?? (typeof label === 'string' ? label : 'Mai multe informații');

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={accessibleLabel}
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          padding: 0,
          margin: 0,
          background: 'transparent',
          border: 'none',
          borderRadius: '50%',
          cursor: 'help',
          color: theme.colors.neutral500,
          lineHeight: 0,
        }}
      >
        <Information width={`${size}px`} height={`${size}px`} fill="currentColor" />
      </button>
      {open &&
        ReactDOM.createPortal(
          <div
            ref={popupRef}
            role="tooltip"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              transform: pos.transform,
              transformOrigin: pos.origin,
              padding: '8px 12px',
              background: theme.colors.neutral800,
              color: theme.colors.neutral0,
              fontSize: 12,
              fontFamily: 'inherit',
              fontWeight: 500,
              borderRadius: 4,
              whiteSpace: 'normal',
              maxWidth: 280,
              minWidth: 160,
              zIndex: 99999,
              lineHeight: 1.45,
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              pointerEvents: 'auto',
            }}
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  );
}
