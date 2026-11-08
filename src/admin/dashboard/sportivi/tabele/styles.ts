/**
 * CSS of the Sportivi "Tabele" tab. Tokens only (var(--theme-*), var(--ui-*)).
 * No backtick inside the string (one stray backtick blanks the admin); no dashed or dotted lines; no pills or circles.
 * On a phone the page never scrolls sideways: every parent can shrink (min-width:0) and the table scrolls inside its own box with its first column fixed.
 */
export const TABELE_CSS = `
.ui-root .tbl-page{min-width:0;max-width:100%}
.ui-root .tbl-bar{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 12px;padding:14px 18px;border-bottom:1px solid var(--theme-border);min-width:0}
.ui-root .tbl-bar .tbl-pick{flex:1 1 280px;min-width:0;max-width:420px}
.ui-root .tbl-bar .tbl-pick .ui-sel{width:100%}
.ui-root .tbl-acts{display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-width:0}
.ui-root .tbl-acts-end{margin-left:auto}
.ui-root .tbl-label{display:block;margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-text-secondary)}
.ui-root .tbl-builder{padding:16px 18px;border-bottom:1px solid var(--theme-border);min-width:0}
.ui-root .tbl-builder .tbl-sheet{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 24px}
.ui-root .tbl-sheet .tbl-wide{grid-column:1/-1}
.ui-root .tbl-sheet{display:flex;flex-direction:column;gap:16px;min-width:0}
.ui-root .tbl-sec{min-width:0}
.ui-root .tbl-scope{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px}
.ui-root .tbl-scope .ui-sel{width:100%}
.ui-root .tbl-cols{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;max-height:280px;overflow-y:auto}
.ui-root .tbl-col{display:flex;align-items:center;gap:6px;padding:3px 6px;border:1px solid transparent;background:var(--theme-surface)}
.ui-root .tbl-col[data-on="true"]{border-color:var(--theme-border);background:var(--theme-surface-subtle)}
.ui-root .tbl-col .ui-check{flex:1;min-width:0}
.ui-root .tbl-grip{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:none;background:none;color:var(--theme-text-muted);cursor:grab}
.ui-root .tbl-grip[disabled]{visibility:hidden}
.ui-root .tbl-filters{display:flex;flex-direction:column;gap:8px}
.ui-root .tbl-filter{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;min-width:0}
.ui-root .tbl-filter .ui-sel{width:auto;min-width:0;max-width:100%}
.ui-root .tbl-filter .ui-input.tbl-val{flex:1 1 140px;min-width:0;width:auto}
.ui-root .tbl-sort{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.ui-root .tbl-quick{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:12px 18px;border-bottom:1px solid var(--theme-border);min-width:0}
.ui-root .tbl-quick-item{display:flex;align-items:center;gap:6px;min-width:0}
.ui-root .tbl-notices{display:flex;flex-direction:column;gap:8px;padding:12px 18px 0}
.ui-root .tbl-count{margin:0;padding:10px 18px 0;font-size:12.5px;color:var(--theme-text-secondary)}
.ui-root .tbl-wrap{position:relative;overflow-x:auto;max-width:100%;min-width:0}
.ui-root .tbl-table{border-collapse:collapse;width:100%;font-size:var(--ui-fs-body)}
.ui-root .tbl-table th{text-align:left;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--theme-text-muted);font-weight:700;padding:10px 14px;border-bottom:1px solid var(--theme-border);white-space:nowrap;background:var(--theme-surface)}
.ui-root .tbl-table th button{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
.ui-root .tbl-table th button:hover{color:var(--theme-text)}
.ui-root .tbl-table th button:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
.ui-root .tbl-table th[aria-sort="ascending"],.ui-root .tbl-table th[aria-sort="descending"]{color:var(--theme-primary)}
.ui-root .tbl-table td{padding:9px 14px;border-bottom:1px solid var(--theme-border-subtle);vertical-align:middle;white-space:nowrap;background:var(--theme-surface)}
.ui-root .tbl-table .tbl-num{text-align:right;font-variant-numeric:tabular-nums}
.ui-root .tbl-table tr.tbl-click{cursor:pointer}
.ui-root .tbl-table tr.tbl-click:hover td{background:var(--theme-surface-subtle)}
.ui-root .tbl-table tr.tbl-click:focus-visible{outline:2px solid var(--theme-focus);outline-offset:-2px}
.ui-root .tbl-table tr.tbl-group td{background:var(--theme-surface-subtle);font-weight:700;padding:0}
.ui-root .tbl-group-btn{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:6px;width:100%;padding:9px 14px;cursor:pointer}
.ui-root .tbl-group-btn:focus-visible{outline:2px solid var(--theme-focus);outline-offset:-2px}
.ui-root .tbl-group-chev{display:inline-flex;transition:transform .12s}
.ui-root .tbl-group-btn[aria-expanded="false"] .tbl-group-chev{transform:rotate(-90deg)}
.ui-root .tbl-table tr.tbl-sub td{font-weight:700;border-top:1px solid var(--theme-border)}
.ui-root .tbl-table tr.tbl-total td{font-weight:700;border-top:2px solid var(--theme-border);background:var(--theme-surface-subtle)}
.ui-root .tbl-pager{padding:11px 18px;border-top:1px solid var(--theme-border)}
.ui-root .tbl-loading{padding:24px 18px}
@media (max-width:640px){
.ui-root .tbl-bar{padding:12px 16px}
.ui-root .tbl-bar .tbl-pick{flex-basis:100%;max-width:none}
.ui-root .tbl-acts-end{margin-left:0}
.ui-root .tbl-quick{padding:10px 16px}
.ui-root .tbl-scope{grid-template-columns:minmax(0,1fr)}
.ui-root .tbl-table th:first-child,.ui-root .tbl-table td:first-child{position:sticky;left:0;z-index:1;box-shadow:1px 0 0 var(--theme-border)}
.ui-root .tbl-table th:first-child{z-index:2}
.ui-root .tbl-table tr.tbl-group td:first-child{position:static;box-shadow:none}
}
`;
