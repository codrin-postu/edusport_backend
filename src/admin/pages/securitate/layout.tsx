import * as React from 'react';

/** "White, no boxes": rows in one card, separated by solid lines. Tokens only. */
export const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
  padding: '10px 0', borderTop: '1px solid var(--theme-border)',
};
export const firstRowStyle: React.CSSProperties = { ...rowStyle, borderTop: 'none', paddingTop: 0 };
export const mutedStyle: React.CSSProperties = { color: 'var(--theme-text-muted)', fontSize: 'var(--ui-fs-body-sm)' };
export const stackStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10 };

export function Row({ first, children }: { first?: boolean; children: React.ReactNode }) {
  return <div style={first ? firstRowStyle : rowStyle}>{children}</div>;
}
