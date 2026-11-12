/** CSS of the money screens (plan 5-6). Tokens only; solid lines only; square segments, no circles. */
export const MONEY_CSS = `
.ui-root .bn-bar{display:flex;flex-direction:column;gap:6px}
.ui-root .bn-bar-top,.ui-root .bn-bar-foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.ui-root .bn-bar-title{font-size:13px;font-weight:600;color:var(--theme-text)}
.ui-root .bn-bar-note{font-size:12px;color:var(--theme-text-muted)}
.ui-root .bn-bar-segs{display:flex;gap:3px}
.ui-root .bn-seg{flex:1;height:8px;background:var(--theme-surface-subtle);border:1px solid var(--theme-border-strong)}
.ui-root .bn-seg--used{background:var(--theme-primary);border-color:var(--theme-primary)}
.ui-root .bn-bar-segs--compact{display:inline-flex;gap:2px;vertical-align:middle}
.ui-root .bn-bar-segs--compact .bn-seg{flex:none;width:10px;height:10px}
.ui-root .bn-used{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.ui-root .bn-card-meta{display:flex;flex-direction:column;gap:4px;align-items:flex-start}
.ui-root .bn-form{display:flex;flex-direction:column;gap:14px}
.ui-root .bn-athlete{display:flex;flex-direction:column;gap:6px}
.ui-root .bn-hint{margin:4px 0 0}
.ui-root .bn-struck{text-decoration:line-through}
.ui-root .bn-toolbar{display:flex;align-items:center;gap:8px;padding:10px 16px}
.ui-root .bn-empty{margin:0;padding:12px 16px}
.ui-root .bn-total{margin:0;padding:12px 16px;font-weight:600;color:var(--theme-text)}
.ui-root .bn-mark{font-size:12px}
.ui-root .bn-code{font-size:12px}
.ui-root .bn-tab{display:flex;flex-direction:column;gap:20px}
.ui-root .bn-block{display:flex;flex-direction:column;gap:8px}
.ui-root .bn-lines{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.ui-root .bn-att{display:block;width:100%;padding:8px 0;font:inherit;font-size:13px;text-align:left;color:var(--theme-text);background:none;border:none;border-bottom:1px solid var(--theme-border);cursor:pointer}
.ui-root .bn-att:hover{background:var(--theme-surface-subtle)}
.ui-root .bn-warn{color:var(--theme-warning)}
.ui-root .bn-mrow{display:grid;grid-template-columns:1.3fr 2.2fr 1fr 1fr 1fr;gap:8px;align-items:baseline;width:100%;text-align:left}
.ui-root .bn-mhead{padding:0 14px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-text-secondary)}
.ui-root .bn-months{display:flex;flex-direction:column;gap:6px}
.ui-root .bn-card{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--theme-border);background:var(--theme-surface)}
.ui-root .bn-card-l1,.ui-root .bn-card-l2{display:flex;align-items:center;gap:6px 12px;flex-wrap:wrap}
.ui-root .bn-card-code{font-size:12px;color:var(--theme-text-muted)}
.ui-root .bn-card-name{font-size:14px;font-weight:600;color:var(--theme-text)}
.ui-root .bn-card-period,.ui-root .bn-card-count{font-size:13px;color:var(--theme-text-secondary)}
.ui-root .bn-days-chev{display:inline-flex;margin-left:4px;vertical-align:middle}
.ui-root .bn-days-toggle{margin-left:auto;padding:2px 0;font:inherit;font-size:13px;color:var(--theme-primary);background:none;border:none;cursor:pointer}
.ui-root .bn-days{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.ui-root .bn-day{display:grid;grid-template-columns:90px 1fr 1fr 20px;gap:8px;align-items:center;width:100%;padding:8px 0;font:inherit;font-size:13px;text-align:left;color:var(--theme-text);background:none;border:none;border-top:1px solid var(--theme-border);cursor:pointer}
.ui-root .bn-day:hover{background:var(--theme-surface-subtle)}
.ui-root .bn-day-group{color:var(--theme-text-secondary)}
.ui-root .bn-day-chev{display:inline-flex;color:var(--theme-text-muted)}
.ui-root .bn-count{margin:0;padding:12px;font-weight:600;color:var(--theme-text);border:1px solid var(--theme-border);background:var(--theme-surface)}
.ui-root .bn-hist-head,.ui-root .bn-hist-cells{display:grid;grid-template-columns:1.3fr 1.5fr .8fr 1.3fr;gap:8px;align-items:baseline;width:100%}
.ui-root .bn-hist-head{padding:0 12px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-text-secondary)}
.ui-root .bn-hist-row{display:block;width:100%;padding:10px 12px;font:inherit;font-size:13px;text-align:left;color:var(--theme-text);background:var(--theme-surface);border:1px solid var(--theme-border);cursor:pointer}
.ui-root .bn-hist-row:hover{background:var(--theme-surface-subtle)}
.ui-root .bn-hist-exp .ui-row-summary{display:block;width:100%;font-size:13px}
.ui-root .bn-hist-code{margin-left:6px;font-size:12px;color:var(--theme-text-muted)}
.ui-root .bn-pay{font-weight:600}
.ui-root .bn-hist-detail{display:flex;flex-direction:column;gap:8px;align-items:flex-start;font-size:13px}
.ui-root .bn-hist-detail p{margin:0}
@media (max-width:640px){
.ui-root .bn-hist-head{display:none}
.ui-root .bn-hist-cells{grid-template-columns:1fr 1fr}
.ui-root .bn-day{grid-template-columns:1fr 20px}
.ui-root .bn-day-unit,.ui-root .bn-day-when,.ui-root .bn-day-group{grid-column:1}
.ui-root .bn-day-chev{grid-column:2;grid-row:1 / span 3}
}
@media (max-width:640px){.ui-root .bn-mrow{grid-template-columns:1fr 1fr}.ui-root .bn-mhead{display:none}}
.ui-root .bn-sq-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:start;gap:12px;padding:12px 16px}
.ui-root .bn-sq{display:block;padding:0;margin:0;font:inherit;text-align:left;color:inherit;text-decoration:none;background:none;border:none;cursor:pointer}
.ui-root .bn-sq--static{cursor:default}
.ui-root .bn-sq .ui-stat{height:100%;display:flex;flex-direction:column;justify-content:flex-start}
.ui-root .bn-sq .ui-stat-caption{margin-top:auto}
.ui-root button.bn-sq:hover .ui-stat{background:var(--theme-surface-subtle)}
.ui-root button.bn-sq:focus-visible{outline:2px solid var(--theme-focus);outline-offset:2px}
.ui-root .bn-trend{display:block}
.ui-root .bn-sechead{margin:8px 0 0;padding:3px 12px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--theme-text-secondary);background:var(--theme-surface-subtle);border:1px solid var(--theme-border)}
.ui-root .bn-bcard{display:flex;flex-direction:column;gap:2px;padding:10px 12px;font-size:13px;border:1px solid var(--theme-border);margin-top:-1px;background:var(--theme-surface);color:var(--theme-text)}
.ui-root .bn-bcards{gap:0}
.ui-root .bn-bcard-name{font-weight:600}
.ui-root .bn-bcard-tot{font-weight:700}
.ui-root .bn-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 16px}
.ui-root .bn-month{display:flex;align-items:center;gap:8px;font-weight:600;color:var(--theme-text)}
.ui-root .bn-section{display:flex;flex-direction:column;gap:8px;padding:12px 16px}
.ui-root .bn-scroll{overflow-x:auto;max-width:100%;border:1px solid var(--theme-border)}
.ui-root .bn-table{width:100%;border-collapse:collapse;font-size:13px}
.ui-root .bn-table th,.ui-root .bn-table td{padding:8px 10px;text-align:right;border-bottom:1px solid var(--theme-border);white-space:nowrap}
.ui-root .bn-table th:first-child,.ui-root .bn-table td:first-child{text-align:left;position:sticky;left:0;background:var(--theme-surface)}
.ui-root .bn-table th{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-text-secondary)}
.ui-root .bn-table .bn-sec td{font-weight:700;background:var(--theme-surface-subtle)}
.ui-root .bn-table .bn-grp td:first-child{padding-left:24px}
.ui-root .bn-table .bn-tot td{font-weight:700}
.ui-root .bn-figures{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:0 16px}
.ui-root .bn-acc-cards{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.ui-root.bn-pop{padding:5px;min-width:120px}
.ui-root.bn-pop button{display:block;width:100%;text-align:left;font:inherit;font-size:12.5px;color:var(--theme-text);background:none;border:none;padding:8px 10px;cursor:pointer}
.ui-root.bn-pop button:hover,.ui-root.bn-pop button:focus-visible{background:var(--theme-surface-subtle);outline:none}
@media (max-width:900px){.ui-root .bn-sq-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ui-root .bn-sq-grid .bn-sq:last-child:nth-child(odd){grid-column:1 / -1}.ui-root .bn-figures{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
