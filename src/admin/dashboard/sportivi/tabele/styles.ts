/**
 * CSS of the Sportivi "Tabele" tab. Tokens only (var(--theme-*), var(--ui-*)).
 * No backtick inside the string (one stray backtick blanks the admin); no dashed or dotted lines; no pills or circles.
 * On a phone the page never scrolls sideways: every parent can shrink (min-width:0) and the table scrolls inside its own box with its first column fixed.
 */
import { phoneQuery, tabletQuery } from '../../../../club/ui-breakpoints';

export const TABELE_CSS = `
.ui-root .tbl-page{min-width:0;max-width:100%}
.ui-root .tbl-ph{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px var(--ui-inset);min-width:0}
.ui-root .tbl-ph .ui-ph-title{flex:1 1 0;min-width:0}
.ui-root .tbl-split{display:inline-flex}
.ui-root .tbl-split .ui-btn:first-child{border-top-right-radius:0;border-bottom-right-radius:0}
.ui-root .tbl-split .ui-btn:last-child{border-top-left-radius:0;border-bottom-left-radius:0;border-left-color:color-mix(in srgb,var(--theme-on-primary) 35%,transparent);padding:0 8px}
.ui-root .tbl-layout{display:flex;gap:12px;align-items:flex-start;min-width:0}
.ui-root .tbl-main{flex:1;min-width:0}
.ui-root .tbl-rail{width:240px;flex:none;padding:8px 0;min-width:0}
.ui-root .tbl-rail-h{display:flex;align-items:center;justify-content:space-between;padding:4px 8px 8px var(--ui-inset)}
.ui-root .tbl-rail-title{margin:0;font-size:13px;font-weight:700;color:var(--theme-text)}
.ui-root .tbl-rail-head{margin:12px 0 4px;padding:0 var(--ui-inset);font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-text-secondary)}
.ui-root .tbl-rail-row{position:relative;display:flex;align-items:center;border-left:3px solid transparent;min-width:0}
.ui-root .tbl-rail-row[data-current="true"]{border-left-color:var(--theme-primary);background:var(--theme-primary-soft)}
.ui-root .tbl-rail[hidden]{display:none}
.ui-root .tbl-rail-row:hover{background:var(--theme-surface-subtle)}
.ui-root .tbl-rail-item{all:unset;box-sizing:border-box;flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;padding:8px calc(var(--ui-inset) - 3px);cursor:pointer;font-size:var(--ui-fs-body);color:var(--theme-text)}
.ui-root .tbl-rail-item:focus-visible{outline:2px solid var(--theme-focus);outline-offset:-2px}
.ui-root .tbl-rail-row[data-current="true"] .tbl-rail-name{font-weight:700}
.ui-root .tbl-rail-author{font-size:11.5px;color:var(--theme-text-muted)}
.ui-root .tbl-rail-menu{flex:none;margin-right:8px;visibility:hidden}
.ui-root .tbl-rail-row:hover .tbl-rail-menu,.ui-root .tbl-rail-row:focus-within .tbl-rail-menu,.ui-root .tbl-rail-menu[data-open="true"]{visibility:visible}
.ui-root .tbl-bar{display:flex;flex-direction:column;gap:10px;padding:12px var(--ui-inset);border-bottom:1px solid var(--theme-border);min-width:0}
.ui-root .tbl-bar-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-width:0}
.ui-root .tbl-bar-row .tbl-period{margin-left:auto}
.ui-root .tbl-bar .ui-sel,.ui-root .tbl-meta .ui-sel{width:auto;min-width:0;max-width:min(240px,100%)}
.ui-root .tbl-types{max-width:100%;overflow-x:auto}
.ui-root .tbl-bar .ui-chip{min-height:var(--ui-control-h);padding:0 4px 0 10px;font-size:var(--ui-fs-body)}
.ui-root .tbl-bar .ui-chip-x{width:24px;height:24px}
.ui-root .tbl-meta{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:12px var(--ui-inset) 0;min-width:0}
.ui-root .tbl-meta .tbl-count{margin-right:auto}
.ui-root .tbl-search{width:220px;max-width:100%}
.ui-root .tbl-chip-btn{all:unset;cursor:pointer;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ui-root .tbl-chip-btn:focus-visible{outline:2px solid var(--theme-focus);outline-offset:2px}
.ui-root .tbl-field{all:unset;box-sizing:border-box;display:flex;align-items:center;min-height:var(--ui-control-h);padding:0 8px;cursor:pointer;font-size:var(--ui-fs-body);color:var(--theme-text)}
.ui-root .tbl-field:hover{background:var(--theme-surface-subtle)}
.ui-root .tbl-field:focus-visible{outline:2px solid var(--theme-focus);outline-offset:-2px}
.ui-root .tbl-months{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.ui-root .tbl-month{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;min-height:var(--ui-control-h);cursor:pointer;font-size:var(--ui-fs-body);color:var(--theme-text);border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);background:var(--theme-surface)}
.ui-root .tbl-month:hover{background:var(--theme-surface-subtle)}
.ui-root .tbl-month[aria-pressed="true"]{background:var(--theme-primary-soft);border-color:var(--theme-primary);color:var(--theme-primary);font-weight:700}
.ui-root .tbl-month:disabled{cursor:not-allowed;color:var(--theme-text-muted);background:var(--theme-surface-subtle)}
.ui-root .tbl-month:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
.ui-root.ui-pop.tbl-pop{width:min(440px,calc(100vw - 16px));padding:12px;max-height:min(520px,calc(100vh - 32px));overflow-y:auto}
.ui-root.ui-pop.tbl-values-pop{width:min(260px,calc(100vw - 16px));display:flex;flex-direction:column;gap:8px}
.ui-root.ui-pop.tbl-period-pop{width:min(260px,calc(100vw - 16px));display:flex;flex-direction:column;gap:10px}
.ui-root.ui-pop.tbl-period-pop .ui-sel{width:100%;max-width:100%}
.ui-root.ui-pop.tbl-cols-pop{width:min(320px,calc(100vw - 16px))}
.ui-root .tbl-cols{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:2px;max-height:360px;overflow-y:auto}
.ui-root .tbl-col{display:flex;align-items:center;gap:6px;padding:3px 6px;border:1px solid transparent;background:var(--theme-surface)}
.ui-root .tbl-col[data-on="true"]{border-color:var(--theme-border);background:var(--theme-surface-subtle)}
.ui-root .tbl-col .ui-check{flex:1;min-width:0}
.ui-root .tbl-col[data-on="false"] .ui-check{color:var(--theme-text-muted)}
.ui-root .tbl-col-move{display:inline-flex;align-items:center;gap:2px;margin-left:auto}
.ui-root .tbl-notices{display:flex;flex-direction:column;gap:8px;padding:12px var(--ui-inset) 0}
.ui-root .tbl-count{margin:0;font-size:12.5px;color:var(--theme-text-secondary)}
.ui-root .tbl-wrap{position:relative;overflow-x:auto;max-width:100%;min-width:0}
.ui-root .tbl-table{border-collapse:collapse;width:100%;font-size:var(--ui-fs-body)}
.ui-root .tbl-table th{text-align:left;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--theme-text-muted);font-weight:700;padding:10px 14px;border-bottom:1px solid var(--theme-border);white-space:nowrap;background:var(--theme-surface)}
.ui-root .tbl-table th button{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
.ui-root .tbl-table th button:hover{color:var(--theme-text)}
.ui-root .tbl-table th button:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
.ui-root .tbl-table th[aria-sort="ascending"],.ui-root .tbl-table th[aria-sort="descending"]{color:var(--theme-primary)}
.ui-root .tbl-table th:first-child,.ui-root .tbl-table td:first-child{padding-left:var(--ui-inset)}
.ui-root .tbl-table th:last-child,.ui-root .tbl-table td:last-child{padding-right:var(--ui-inset)}
.ui-root .tbl-table td{padding:9px 14px;border-bottom:1px solid var(--theme-border-subtle);vertical-align:middle;white-space:nowrap;background:var(--theme-surface)}
.ui-root .tbl-table .tbl-num{text-align:right;font-variant-numeric:tabular-nums}
.ui-root .tbl-table tr.tbl-row:hover td{background:var(--theme-surface-subtle)}
.ui-root .tbl-table .tbl-nr{width:1%;text-align:right;color:var(--theme-text-muted);font-variant-numeric:tabular-nums}
.ui-root .tbl-table th.tbl-nr{text-transform:none;letter-spacing:0}
.ui-root .tbl-name{color:var(--theme-primary);font-weight:600;text-decoration:none}
.ui-root .tbl-name:hover{text-decoration:underline}
.ui-root .tbl-name:focus-visible{outline:2px solid var(--theme-focus);outline-offset:2px}
.ui-root .tbl-table .tbl-mk{text-align:center;width:44px;padding-left:4px;padding-right:4px}
.ui-root .tbl-table th.tbl-mk{line-height:1.25;text-transform:none;letter-spacing:0;font-size:12px}
.ui-root .tbl-mark{display:inline-block;width:12px;height:12px;background:var(--theme-primary);vertical-align:middle}
.ui-root .tbl-table tr.tbl-group td{background:var(--theme-surface-subtle);font-weight:700;padding:0}
.ui-root .tbl-group-btn{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:6px;width:100%;min-height:var(--ui-control-h);padding:0 var(--ui-inset);cursor:pointer}
.ui-root .tbl-group-btn:focus-visible{outline:2px solid var(--theme-focus);outline-offset:-2px}
.ui-root .tbl-group-count{margin-left:auto;font-weight:500;color:var(--theme-text-secondary)}
.ui-root .tbl-group-chev{display:inline-flex;transition:transform .12s}
.ui-root .tbl-group-btn[aria-expanded="false"] .tbl-group-chev{transform:rotate(-90deg)}
.ui-root .tbl-table tr.tbl-sub td{font-weight:700;border-top:1px solid var(--theme-border)}
.ui-root .tbl-table tr.tbl-total td{font-weight:700;border-top:2px solid var(--theme-border);background:var(--theme-surface-subtle)}
.ui-root .tbl-pager{padding:12px var(--ui-inset);border-top:1px solid var(--theme-border)}
.ui-root .tbl-loading{padding:24px var(--ui-inset)}
@media ${phoneQuery}{
.ui-root .tbl-ph .ui-ph-title{flex-basis:calc(100% - 60px)}
.ui-root .tbl-bar-row .tbl-period,.ui-root .tbl-bar-row .tbl-type-select{margin-left:0;flex:1 1 100%;max-width:100%}
.ui-root .tbl-bar .tbl-period .ui-sel{width:100%;max-width:100%}
.ui-root .tbl-search{flex:1 1 100%;width:auto}
}
@media ${tabletQuery}{
.ui-root .tbl-rail:not([hidden]){display:block;position:fixed;inset:0 auto 0 0;z-index:var(--ui-z-drawer,390);width:min(300px,85vw);overflow-y:auto;border-radius:0;box-shadow:var(--theme-shadow-md)}
.ui-root .tbl-scrim{position:fixed;inset:0;z-index:calc(var(--ui-z-drawer,390) - 1);background:var(--theme-overlay)}
}
`;
