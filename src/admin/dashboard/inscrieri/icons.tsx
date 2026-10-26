import * as React from 'react';

/** Înscrieri page icons (14px grid, currentColor, square shapes only: no circles). */
type P = { size?: number };

const svg = (size: number, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

/** Person: square head, shoulders. Used by the "Sportiv existent" line. */
export const IconUser = ({ size = 14 }: P) =>
  svg(size, <path d="M4.75 1.75h4.5v4.5h-4.5zM2 12.5c.5-2.6 2.5-3.9 5-3.9s4.5 1.3 5 3.9" stroke="currentColor" strokeWidth="1.4" />);

/** Pencil on a line. Used by "Editează". */
export const IconEdit = ({ size = 14 }: P) =>
  svg(size, <path d="M2 12.5h10M9 2.5l2.5 2.5L5.5 11H3V8.5z" stroke="currentColor" strokeWidth="1.4" />);
