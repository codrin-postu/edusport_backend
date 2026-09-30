import * as React from 'react';
import { cx } from './cx';

export interface SpinnerProps {
  /** Pixel size of the ring. Default 16. */
  size?: number;
  /** Accessible label; omit when the spinner sits next to visible text. */
  label?: string;
  className?: string;
}

/** Loading ring, drawn in SVG so it needs no border-radius. Colour follows currentColor. */
export function Spinner({ size = 16, label, className }: SpinnerProps) {
  return (
    <svg
      className={cx('ui-spinner', className)}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

/** Centred spinner + text for a loading area. */
export function Loading({ text = 'Se încarcă...' }: { text?: string }) {
  return (
    <div className="ui-loading" role="status">
      <Spinner />
      <span>{text}</span>
    </div>
  );
}

export default Spinner;
