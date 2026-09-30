import * as React from 'react';

/**
 * Small inline icons for the shared components (14px grid, currentColor).
 * Internal: pages keep their own icons. Square line caps only, no circles.
 */

type P = { size?: number };

const svg = (size: number, children: React.ReactNode, box = 14) => (
  <svg width={size} height={size} viewBox={`0 0 ${box} ${box}`} fill="none" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

export const IconPlus = ({ size = 14 }: P) => svg(size, <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" />);

export const IconClose = ({ size = 14 }: P) => svg(size, <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.6" />);

export const IconTrash = ({ size = 14 }: P) =>
  svg(size, <path d="M2.5 4h9M5.5 4V2.5h3V4M4 4l.6 7.5h4.8L10 4" stroke="currentColor" strokeWidth="1.4" />);

export const IconChevronDown = ({ size = 14 }: P) => svg(size, <path d="M3.5 5.5L7 9l3.5-3.5" stroke="currentColor" strokeWidth="1.6" />);

export const IconChevronUp = ({ size = 14 }: P) => svg(size, <path d="M3.5 8.5L7 5l3.5 3.5" stroke="currentColor" strokeWidth="1.6" />);

export const IconArrowRight = ({ size = 14 }: P) => svg(size, <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.5" />);

/** Six-dot drag grip, drawn as squares. */
export const IconGrip = ({ size = 14 }: P) =>
  svg(
    size,
    <g fill="currentColor">
      <rect x="4" y="2" width="2" height="2" />
      <rect x="8" y="2" width="2" height="2" />
      <rect x="4" y="6" width="2" height="2" />
      <rect x="8" y="6" width="2" height="2" />
      <rect x="4" y="10" width="2" height="2" />
      <rect x="8" y="10" width="2" height="2" />
    </g>,
  );

/** Clock drawn in a square frame (no round shapes). */
export const IconClock = ({ size = 14 }: P) =>
  svg(
    size,
    <>
      <rect x="1.75" y="1.75" width="10.5" height="10.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 4v3.3h2.5" stroke="currentColor" strokeWidth="1.4" />
    </>,
  );

/** "i" in a square frame. */
export const IconInfo = ({ size = 14 }: P) =>
  svg(
    size,
    <>
      <rect x="1.75" y="1.75" width="10.5" height="10.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 6v4.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6.25" y="3.5" width="1.5" height="1.5" fill="currentColor" />
    </>,
  );
