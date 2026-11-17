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

export const IconColumns = ({ size = 14 }: P) =>
  svg(size, <path d="M1.5 2.5h11v9h-11zM5.2 2.5v9M8.8 2.5v9" stroke="currentColor" strokeWidth="1.4" />);

export const IconPlus = ({ size = 14 }: P) => svg(size, <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" />);

export const IconClose = ({ size = 14 }: P) => svg(size, <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.6" />);

export const IconTrash = ({ size = 14 }: P) =>
  svg(size, <path d="M2.5 4h9M5.5 4V2.5h3V4M4 4l.6 7.5h4.8L10 4" stroke="currentColor" strokeWidth="1.4" />);

export const IconChevronDown = ({ size = 14 }: P) => svg(size, <path d="M3.5 5.5L7 9l3.5-3.5" stroke="currentColor" strokeWidth="1.6" />);

export const IconChevronUp = ({ size = 14 }: P) => svg(size, <path d="M3.5 8.5L7 5l3.5 3.5" stroke="currentColor" strokeWidth="1.6" />);

export const IconChevronLeft = ({ size = 14 }: P) => svg(size, <path d="M8.5 3.5L5 7l3.5 3.5" stroke="currentColor" strokeWidth="1.6" />);

export const IconChevronRight = ({ size = 14 }: P) => svg(size, <path d="M5.5 3.5L9 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" />);

export const IconCheck = ({ size = 14 }: P) => svg(size, <path d="M3 7.5l2.6 2.6L11 4.5" stroke="currentColor" strokeWidth="1.6" />);

export const IconArrowRight = ({ size = 14 }: P) => svg(size, <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.5" />);

/** Magnifier with a square lens (no round shapes). */
export const IconSearch = ({ size = 14 }: P) => svg(size, <path d="M1.75 1.75h7.5v7.5h-7.5zM9.25 9.25l3.25 3.25" stroke="currentColor" strokeWidth="1.5" />);

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

/** Calendar drawn in a square frame (no round shapes). */
export const IconCalendar = ({ size = 14 }: P) =>
  svg(
    size,
    <>
      <rect x="1.75" y="2.75" width="10.5" height="9.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.75 5.75h10.5M4.5 1.5v2.5M9.5 1.5v2.5" stroke="currentColor" strokeWidth="1.4" />
    </>,
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

/** Padlock: square body and a square shackle (no round shapes). */
export const IconLock = ({ size = 14 }: P) =>
  svg(
    size,
    <>
      <rect x="2.75" y="6.25" width="8.5" height="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.5 6.25V3.5h5v2.75" stroke="currentColor" strokeWidth="1.4" />
    </>,
  );

/** "!" in a triangle (no round shapes). */
export const IconWarning = ({ size = 14 }: P) =>
  svg(
    size,
    <>
      <path d="M7 1.6L12.6 12.2H1.4z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 5.2v3.6" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6.25" y="9.4" width="1.5" height="1.5" fill="currentColor" />
    </>,
  );

/** Globe in a square frame: a meridian and an equator (no round shapes). Place it at 16px. */
export const IconGlobe = ({ size = 16 }: P) =>
  svg(
    size,
    <>
      <rect x="1.75" y="1.75" width="10.5" height="10.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 1.75v10.5M1.75 7h10.5M4.4 1.75c-1 2.9-1 7.6 0 10.5M9.6 1.75c1 2.9 1 7.6 0 10.5" stroke="currentColor" strokeWidth="1.1" />
    </>,
  );

/** Person: a square head over square shoulders (no round shapes). Place it at 16px. */
export const IconUser = ({ size = 16 }: P) =>
  svg(
    size,
    <>
      <rect x="4.75" y="1.75" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 12.25v-2.5h10v2.5" stroke="currentColor" strokeWidth="1.3" />
    </>,
  );

/** Copy: two overlapping squares. */
export const IconCopy = ({ size = 14 }: P) =>
  svg(size, <path d="M4.5 4.5h7v7h-7zM2.5 9.5v-7h7" stroke="currentColor" strokeWidth="1.4" />);

/** Chat bubble (square, with a corner tail), for the WhatsApp action. */
export const IconWhatsapp = ({ size = 14 }: P) =>
  svg(size, <path d="M2 2h10v7.5H6.5L3.5 12V9.5H2z" stroke="currentColor" strokeWidth="1.4" />);
