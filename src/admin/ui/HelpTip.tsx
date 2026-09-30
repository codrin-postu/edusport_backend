import * as React from 'react';
import { Popover, type PopoverPlacement } from './Popover';
import { IconInfo } from './icons';

export interface HelpTipProps {
  /** The help text. */
  label: React.ReactNode;
  /** Icon and hit-area size in px. Default 18. */
  size?: number;
  placement?: PopoverPlacement;
  /** Accessible name when `label` is not a string. Default "Mai multe informații". */
  ariaLabel?: string;
}

/**
 * Inline help icon with a tooltip on hover, focus and tap (tap toggles, a tap
 * outside or Escape closes). The tooltip is portalled to <body>, so no
 * overflow or z-index parent can hide it. Port of the plugin's
 * components/HelpTip, on tokens (inverse surface: primary text colour as the
 * background).
 */
export function HelpTip({ label, size = 18, placement = 'bottom-start', ariaLabel }: HelpTipProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLButtonElement | null>(null);
  const tipId = React.useId().replace(/:/g, '');
  const hover = React.useRef(false);
  const closeT = React.useRef<number | undefined>(undefined);

  const show = () => {
    window.clearTimeout(closeT.current);
    setOpen(true);
  };
  // A short delay lets the pointer travel from the icon onto the tooltip.
  const hideSoon = () => {
    window.clearTimeout(closeT.current);
    closeT.current = window.setTimeout(() => {
      if (!hover.current) setOpen(false);
    }, 120);
  };
  React.useEffect(() => () => window.clearTimeout(closeT.current), []);

  const name = ariaLabel ?? (typeof label === 'string' ? label : 'Mai multe informații');

  return (
    <>
      <button
        ref={ref}
        type="button"
        className="ui-root ui-tipbtn"
        style={{ width: size, height: size }}
        aria-label={name}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={() => setOpen(false)}
      >
        <IconInfo size={Math.round(size * 0.8)} />
      </button>
      <Popover
        open={open}
        anchorRef={ref}
        onClose={() => setOpen(false)}
        placement={placement}
        offset={6}
        id={tipId}
        role="tooltip"
        className="ui-tip"
        popoverProps={{
          onMouseEnter: () => {
            hover.current = true;
            show();
          },
          onMouseLeave: () => {
            hover.current = false;
            hideSoon();
          },
        }}
      >
        {label}
      </Popover>
    </>
  );
}

export default HelpTip;
