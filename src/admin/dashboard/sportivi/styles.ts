/**
 * CSS of the Sportivi list, record and windows (plan 3-5). Tokens only (var(--theme-*), var(--ui-*)).
 * No backtick inside the string (one stray backtick blanks the admin); no dashed or dotted lines;
 * no pills or circles. Popovers and sheets portal with .ui-root, so these rules reach them.
 */
export const SPORTIVI_CSS = `
.ui-root .spv-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 18px;border-bottom:1px solid var(--theme-border)}
.ui-root .spv-q{position:relative;display:block;flex:1 1 300px;max-width:520px;min-width:240px}
.ui-root .spv-q svg{position:absolute;left:10px;top:0;bottom:0;margin:auto 0;color:var(--theme-text-muted);pointer-events:none}
.ui-root .spv-q .ui-input{padding-left:30px;text-overflow:ellipsis}
.ui-root .ui-sel.spv-season{width:auto;flex:none}
.ui-root .spv-sort{display:flex;align-items:center;gap:6px;margin-left:auto;font-size:12.5px;color:var(--theme-text-secondary)}
.ui-root .spv-sort .ui-sel{width:auto}
.ui-root .spv-chips{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding:10px 18px;border-bottom:1px solid var(--theme-border);background:var(--theme-surface-subtle)}
.ui-root .spv-chips-n{font-size:12px;color:var(--theme-text-muted)}
.ui-root .spv-banner{padding:12px 18px 0}
.ui-root .spv-name{font-weight:600;color:var(--theme-text)}
.ui-root a.spv-name{text-decoration:none}
.ui-root a.spv-name:hover{text-decoration:underline}
.ui-root .spv-miss{display:flex;align-items:center;gap:4px;font-size:11.5px;line-height:1.2;margin-top:1px;color:var(--theme-warning)}
.ui-root .spv-unsorted{color:var(--theme-text-muted)}
.ui-root .spv-muted{color:var(--theme-text-muted)}
.ui-root .spv-sub2{display:block;font-size:12px;color:var(--theme-text-muted)}
.ui-root .spv-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 18px;border-top:1px solid var(--theme-border);font-size:12.5px;color:var(--theme-text-secondary)}
.ui-root .spv-count{margin:0;padding:10px 16px 0;font-size:12.5px;color:var(--theme-text-secondary)}
.ui-root .spv-cards{list-style:none;margin:0;padding:10px 16px;display:flex;flex-direction:column;gap:8px}
.ui-root .spv-card{display:flex;flex-direction:column;align-items:flex-start;gap:3px;width:100%;text-align:left;font:inherit;color:var(--theme-text);background:var(--theme-surface);border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);padding:10px 12px;cursor:pointer}
.ui-root .spv-card:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
.ui-root .spv-more{padding:0 16px 16px}
.ui-root .spv-more .ui-btn{width:100%}
.ui-root .spv-head-acts{display:flex;align-items:center;gap:8px}
.ui-root .spv-phone-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding:0 0 10px}
.ui-root .spv-phone-head .spv-head-acts{margin-left:auto}
.ui-root .spv-dups{display:flex;flex-direction:column;gap:8px;padding:12px 18px 0}
.ui-root .spv-dup-acts{display:flex;gap:6px;flex-wrap:wrap}
.ui-root .spv-dups .ui-notice{align-items:center}
.ui-root .spv-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 24px;margin:0}
.ui-root .spv-field{min-width:0}
.ui-root .spv-label{display:flex;align-items:center;justify-content:space-between;gap:8px;line-height:16px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-text-secondary)}
.ui-root .spv-link{font:inherit;font-size:12.5px;line-height:16px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--theme-primary);background:none;border:none;padding:0;cursor:pointer}
.ui-root .spv-link:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
.ui-root .spv-missing{display:block;margin:2px 0 0;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-warning)}
.ui-root .spv-value{margin:4px 0 0;min-height:20px;color:var(--theme-text);overflow-wrap:anywhere}
.ui-root .spv-value .spv-missing{display:inline;margin:0 6px 0 0}
.ui-root .spv-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 24px}
.ui-root .spv-form .spv-wide{grid-column:1/-1}
.ui-root .spv-since .ui-bdate{grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:6px}
.ui-root .spv-actions{display:flex;justify-content:flex-end;gap:8px}
.ui-root .spv-line{margin:0;color:var(--theme-text)}
.ui-root .spv-h{margin:0;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-text-secondary)}
.ui-root .spv-rows{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:4px}
.ui-root .spv-docs,.ui-root .spv-hist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.ui-root .spv-doc{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--theme-border)}
.ui-root .spv-doc-acts{display:flex;gap:4px}
.ui-root .spv-doc-acts .ui-btn{color:var(--theme-primary)}
.ui-root .spv-nowrap{white-space:nowrap}
.ui-root .spv-hist li{padding:8px 0;border-bottom:1px solid var(--theme-border);color:var(--theme-text);overflow-wrap:anywhere}
.ui-root .spv-hist-h{display:flex;gap:10px;flex-wrap:wrap;font-size:12.5px}
.ui-root .spv-hist-h span{color:var(--theme-text-muted)}
.ui-root .spv-search{display:flex;flex-direction:column;gap:8px}
.ui-root .spv-results{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.ui-root .spv-result{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;font:inherit;color:var(--theme-text);background:var(--theme-surface);border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);padding:8px 12px;cursor:pointer}
.ui-root .spv-result:hover,.ui-root .spv-result[data-active]{border-color:var(--theme-primary);background:var(--theme-primary-soft)}
.ui-root .spv-result-sub{font-size:12px;color:var(--theme-text-muted)}
.ui-root .spv-merge-wrap{max-width:100%;overflow-x:auto}
.ui-root .spv-merge-head{display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.ui-root .spv-merge{width:100%;min-width:520px;border-collapse:collapse}
.ui-root .spv-merge th,.ui-root .spv-merge td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--theme-border)}
.ui-root .spv-merge thead th{display:table-cell}
.ui-root .spv-merge th[scope=row],.ui-root .spv-merge thead td{position:sticky;left:0;z-index:1;background:var(--theme-surface)}
.ui-root .spv-merge th[scope=row]{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--theme-text-secondary);white-space:nowrap}
.ui-root .spv-merge td.spv-diff{background:var(--theme-warning-bg)}
.ui-root .ui-tabs.spv-tabs{padding:0 18px}
.ui-root.ui-pop.spv-menu{width:240px;padding:5px}
.ui-root.spv-menu button{display:block;width:100%;text-align:left;font:inherit;font-size:12.5px;color:var(--theme-text);background:none;border:none;padding:8px 10px;border-radius:var(--ui-radius-sm);cursor:pointer}
.ui-root.spv-menu button:hover,.ui-root.spv-menu button:focus-visible{background:var(--theme-surface-subtle);outline:none}
.ui-root.spv-menu button.spv-danger{color:var(--theme-danger)}
.ui-root .spv-lines span{display:block}
.ui-root .spv-lines span+span{margin-top:6px}
.ui-root .spv-bulk{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid var(--theme-border);background:var(--theme-primary-soft)}
.ui-root .spv-check{width:40px}
.ui-root .spv-card-row{display:flex;align-items:center;gap:10px}
.ui-root .spv-card-row .spv-card{flex:1;min-width:0}
@media (max-width: 640px){
.ui-root .spv-toolbar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:10px 16px}
.ui-root .spv-q{grid-column:1/-1;min-width:0}
.ui-root .spv-toolbar .ui-input{min-height:40px}
.ui-root .ui-sel.spv-season,.ui-root .spv-toolbar .ui-filters,.ui-root .spv-toolbar .ui-fbtn{width:100%}
.ui-root .spv-toolbar .ui-fbtn{min-height:40px;justify-content:center}
.ui-root .spv-chips{padding:10px 16px;background:none}
.ui-root .spv-merge{min-width:460px}
.ui-root .spv-merge th[scope=row]{white-space:normal;width:104px}
.ui-root .spv-fields,.ui-root .spv-form{grid-template-columns:minmax(0,1fr)}
.ui-root .spv-banner{padding:10px 16px 0}
.ui-root .spv-dups{padding:10px 0 0}
}
`;
