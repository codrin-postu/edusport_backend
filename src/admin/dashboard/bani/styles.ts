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
.ui-root .bn-empty{margin:0;padding:12px 16px}
.ui-root .bn-total{margin:0;padding:12px 16px;font-weight:600;color:var(--theme-text)}
.ui-root .bn-mark{font-size:12px}
.ui-root .bn-tab{display:flex;flex-direction:column;gap:20px}
.ui-root .bn-block{display:flex;flex-direction:column;gap:8px}
.ui-root .bn-lines{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.ui-root .bn-att{display:block;width:100%;padding:8px 0;font:inherit;font-size:13px;text-align:left;color:var(--theme-text);background:none;border:none;border-bottom:1px solid var(--theme-border);cursor:pointer}
.ui-root .bn-att:hover{background:var(--theme-surface-subtle)}
.ui-root .bn-warn{color:var(--theme-warning)}
.ui-root .bn-mrow{display:grid;grid-template-columns:1.3fr 2.2fr 1fr 1fr 1fr;gap:8px;align-items:baseline;width:100%;text-align:left}
.ui-root .bn-mhead{padding:0 14px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-text-secondary)}
.ui-root .bn-months{display:flex;flex-direction:column;gap:6px}
@media (max-width:640px){.ui-root .bn-mrow{grid-template-columns:1fr 1fr}.ui-root .bn-mhead{display:none}}
`;
