/**
 * CSS of the Sportivi "Tabele" tab. Tokens only (var(--theme-*), var(--ui-*)).
 * No backtick inside the string (one stray backtick blanks the admin); no dashed or dotted lines; no pills or circles.
 * On a phone the page never scrolls sideways: every parent can shrink (min-width:0) and the table scrolls inside its own box with its first column fixed.
 */
export const TABELE_CSS = `
.ui-root .tbl-page{min-width:0;max-width:100%}
.ui-root .tbl-layout{display:grid;grid-template-columns:260px minmax(0,1fr);gap:16px;align-items:start;min-width:0}
.ui-root .tbl-rail{background:var(--theme-surface);border:1px solid var(--theme-border);padding:14px 0;min-width:0}
.ui-root .tbl-rail-title{margin:0 0 8px;padding:0 16px;font-size:13px;font-weight:700;color:var(--theme-text)}
.ui-root .tbl-rail-head{margin:12px 0 4px;padding:0 16px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-text-secondary)}
.ui-root .tbl-rail-row{position:relative;display:flex;align-items:center;border-left:3px solid transparent;min-width:0}
.ui-root .tbl-rail-row[data-current="true"]{border-left-color:var(--theme-primary);background:var(--theme-surface-subtle)}
.ui-root .tbl-rail-row:hover{background:var(--theme-surface-subtle)}
.ui-root .tbl-rail-item{all:unset;box-sizing:border-box;flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;padding:8px 13px;cursor:pointer;font-size:var(--ui-fs-body);color:var(--theme-text)}
.ui-root .tbl-rail-item:focus-visible{outline:2px solid var(--theme-focus);outline-offset:-2px}
.ui-root .tbl-rail-row[data-current="true"] .tbl-rail-name{font-weight:700}
.ui-root .tbl-rail-author{font-size:11.5px;color:var(--theme-text-muted)}
.ui-root .tbl-rail-menu{flex:none;margin-right:8px;visibility:hidden}
.ui-root .tbl-rail-row:hover .tbl-rail-menu,.ui-root .tbl-rail-row:focus-within .tbl-rail-menu,.ui-root .tbl-rail-menu[data-open="true"]{visibility:visible}
.ui-root .tbl-rail-phone{min-width:0}
.ui-root .tbl-rail-phone .ui-sel{width:100%}
.ui-root .tbl-main{min-width:0}
@media (max-width:900px){
.ui-root .tbl-layout{grid-template-columns:minmax(0,1fr)}
}
.ui-root .tbl-controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:14px 18px;border-bottom:1px solid var(--theme-border);min-width:0}
.ui-root .tbl-controls .ui-sel{width:auto;min-width:0;max-width:100%}
.ui-root .tbl-named{display:inline-flex;align-items:center;gap:6px;min-width:0}
.ui-root .tbl-named-label{font-size:var(--ui-fs-body);color:var(--theme-text-secondary);white-space:nowrap}
.ui-root .tbl-subject{font-weight:700}
.ui-root .tbl-sep{align-self:stretch;width:1px;min-height:24px;background:var(--theme-border);margin:0 4px}
.ui-root .tbl-aspect{margin-left:auto}
.ui-root .tbl-chip{display:inline-flex;align-items:center;gap:2px}
.ui-root.ui-pop.tbl-pop{width:min(440px,calc(100vw - 16px));padding:12px;max-height:min(520px,calc(100vh - 32px));overflow-y:auto}
.ui-root.ui-pop.tbl-cols-pop{width:min(320px,calc(100vw - 16px))}
.ui-root .tbl-pop-head{margin:12px 0 6px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-text-secondary)}
.ui-root .tbl-export-note{margin:0;padding:6px 10px 8px;font-size:12px;color:var(--theme-text-muted)}
.ui-root .tbl-rail-phone-row{display:flex;align-items:center;gap:8px;min-width:0}
.ui-root .tbl-rail-phone-row .ui-sel{flex:1;min-width:0}
.ui-root .tbl-rail-phone .tbl-rail-menu{visibility:visible;margin-right:0}
.ui-root .tbl-acts{display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-width:0}
.ui-root .tbl-label{display:block;margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-text-secondary)}
.ui-root .tbl-cols{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;max-height:280px;overflow-y:auto}
.ui-root .tbl-col{display:flex;align-items:center;gap:6px;padding:3px 6px;border:1px solid transparent;background:var(--theme-surface)}
.ui-root .tbl-col[data-on="true"]{border-color:var(--theme-border);background:var(--theme-surface-subtle)}
.ui-root .tbl-col .ui-check{flex:1;min-width:0}
.ui-root .tbl-grip{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:none;background:none;color:var(--theme-text-muted);cursor:grab}
.ui-root .tbl-grip[disabled]{visibility:hidden}
.ui-root .tbl-filter{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;min-width:0}
.ui-root .tbl-filter .ui-sel{width:auto;min-width:0;max-width:100%}
.ui-root .tbl-filter .ui-input.tbl-val{flex:1 1 140px;min-width:0;width:auto}
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
.ui-root .tbl-table .tbl-n{text-align:right;color:var(--theme-text-muted);font-variant-numeric:tabular-nums;width:44px;min-width:44px}
.ui-root .tbl-wrap-foaie{max-height:70vh;overflow:auto}
.ui-root .tbl-foaie th,.ui-root .tbl-foaie td{border:1px solid var(--theme-border)}
.ui-root .tbl-foaie thead th{position:sticky;top:0;z-index:3}
.ui-root .tbl-foaie tbody tr:nth-child(even) td{background:var(--theme-surface-subtle)}
.ui-root .tbl-foaie th.tbl-n,.ui-root .tbl-foaie td.tbl-n,.ui-root .tbl-foaie th.tbl-n+th,.ui-root .tbl-foaie td.tbl-n+td{position:sticky;z-index:2}
.ui-root .tbl-foaie th.tbl-n,.ui-root .tbl-foaie td.tbl-n{left:0}
.ui-root .tbl-foaie th.tbl-n+th,.ui-root .tbl-foaie td.tbl-n+td{left:44px}
.ui-root .tbl-foaie thead th.tbl-n,.ui-root .tbl-foaie thead th.tbl-n+th{z-index:4}
.ui-root .tbl-foaie tr.tbl-group td{position:static}
.ui-root .tbl-pager{padding:11px 18px;border-top:1px solid var(--theme-border)}
.ui-root .tbl-loading{padding:24px 18px}
@media (max-width:640px){
.ui-root .tbl-controls{padding:12px 16px}
.ui-root .tbl-aspect{margin-left:0}
.ui-root .tbl-sep{display:none}
.ui-root .tbl-table:not(.tbl-foaie) th:first-child,.ui-root .tbl-table:not(.tbl-foaie) td:first-child{position:sticky;left:0;z-index:1;box-shadow:1px 0 0 var(--theme-border)}
.ui-root .tbl-table:not(.tbl-foaie) th:first-child{z-index:2}
.ui-root .tbl-table:not(.tbl-foaie) tr.tbl-group td:first-child{position:static;box-shadow:none}
}
`;
