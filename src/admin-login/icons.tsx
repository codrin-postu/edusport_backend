import * as React from 'react';

const svg = (children: React.ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">{children}</svg>
);

export const IconEye = () => svg(
  <>
    <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" stroke="currentColor" strokeWidth="1.4" />
    <path d="M6.5 6.5h3v3h-3z" stroke="currentColor" strokeWidth="1.4" />
  </>,
);

export const IconEyeOff = () => svg(
  <>
    <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" stroke="currentColor" strokeWidth="1.4" />
    <path d="M2.5 13.5l11-11" stroke="currentColor" strokeWidth="1.4" />
  </>,
);
