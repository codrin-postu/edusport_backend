/** CSS of the money screens (plan 5-6). Tokens only; solid lines only; square segments, no circles. */
export const MONEY_CSS = `
.ui-root .bn-bar{display:flex;flex-direction:column;gap:6px}
.ui-root .bn-bar-top,.ui-root .bn-bar-foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.ui-root .bn-bar-title{font-size:13px;font-weight:600;color:var(--theme-text)}
.ui-root .bn-bar-note{font-size:12px;color:var(--theme-text-muted)}
.ui-root .bn-bar-segs{display:flex;gap:3px}
.ui-root .bn-seg{flex:1;height:8px;background:var(--theme-surface-subtle);border:1px solid var(--theme-border-strong)}
.ui-root .bn-seg--used{background:var(--theme-primary);border-color:var(--theme-primary)}
.ui-root .bn-form{display:flex;flex-direction:column;gap:14px}
.ui-root .bn-athlete{display:flex;flex-direction:column;gap:6px}
.ui-root .bn-hint{margin:4px 0 0}
.ui-root .bn-struck{text-decoration:line-through}
.ui-root .bn-toolbar{display:flex;align-items:center;gap:8px;padding:10px 16px}
.ui-root .bn-total{margin:0;padding:12px 16px;font-weight:600;color:var(--theme-text)}
.ui-root .bn-mark{font-size:12px}
`;
