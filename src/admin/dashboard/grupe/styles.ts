/**
 * CSS of Grupe and the group page (phase 4). Tokens only; no backtick inside the string; solid lines only; no pills
 * or circles (the count badge and the day toggles are square). The Sportivi CSS (SPORTIVI_CSS) is loaded alongside it.
 */
export const GRUPE_CSS = `
.ui-root .grp-head-acts{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.ui-root .ui-btn.grp-unassigned{background:var(--theme-surface);border-color:var(--theme-cat-eveniment);color:var(--theme-cat-eveniment-soft-fg)}
.ui-root .ui-btn.grp-unassigned:hover:not(:disabled){background:var(--theme-cat-eveniment-soft);border-color:var(--theme-cat-eveniment);color:var(--theme-cat-eveniment-soft-fg)}
.ui-root .grp-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:18px;padding:0 5px;margin-left:6px;font-size:11px;font-weight:700;border-radius:var(--ui-radius-sm);background:var(--theme-cat-eveniment-soft-fg);color:var(--theme-cat-eveniment-soft)}
.ui-root .grp-tabs{padding:0 18px}
.ui-root .grp-lines div+div{margin-top:2px}
.ui-root .grp-form{display:flex;flex-direction:column;gap:14px}
.ui-root .gtt{display:flex;flex-direction:column;gap:10px}
.ui-root .gtt-section{display:flex;flex-direction:column;gap:6px}
.ui-root .gtt-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ui-root .gtt-head{font-weight:600}
.ui-root .gtt-group{padding-left:24px}
.ui-root .gtt-count{font-size:var(--ui-fs-body);font-weight:400;color:var(--theme-text-muted);white-space:nowrap}
.ui-root .gtt-box{display:flex;flex-direction:column;gap:12px;padding:12px 14px;border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);background:var(--theme-surface)}
.ui-root .gtt-title{font-weight:600}
.ui-root .gtt-rest{font-size:var(--ui-fs-body);color:var(--theme-text-muted)}
.ui-root .grp-ua{display:flex;flex-direction:column}
.ui-root .grp-ua-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(170px,230px) auto;gap:8px 10px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--theme-border)}
.ui-root .grp-ua-row:last-child{border-bottom:none}
.ui-root .grp-ua-src{display:block;font-size:12px;color:var(--theme-text-muted)}
.ui-root .grp-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;font-size:13px;color:var(--theme-text-secondary)}
.ui-root .grp-kv{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:8px 14px;align-items:center;margin:0 0 14px}
.ui-root .grp-kv dt{font-size:12px;font-weight:700;color:var(--theme-text-secondary)}
.ui-root .grp-kv dd{margin:0;min-width:0}
.ui-root .grp-pick{display:flex;flex-direction:column;gap:2px;max-height:320px;overflow:auto}
.ui-root .grp-pick label{display:flex;align-items:center;gap:8px;padding:6px 2px}
.ui-root .grp-usual{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
.ui-root .grp-usual-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}
.ui-root .grp-days{display:flex;flex-wrap:wrap;gap:6px}
.ui-root .grp-day{min-width:40px;height:34px;padding:0 8px;font:inherit;font-weight:600;color:var(--theme-text);background:var(--theme-surface);border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);cursor:pointer}
.ui-root .grp-day[aria-pressed=true]{color:var(--theme-on-primary);background:var(--theme-primary);border-color:var(--theme-primary)}
.ui-root .grp-day:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
.ui-root .grp-danger-link{font:inherit;font-size:13px;font-weight:600;color:var(--theme-danger);background:none;border:none;padding:0;cursor:pointer;align-self:flex-start}
.ui-root .grp-cal-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:8px 0}
.ui-root .grp-cal-bar .cal-sp{flex:1}
.ui-root .grp-sec{margin:14px 0 6px}
.ui-root .grp-sec:first-child{margin-top:0}
.ui-root .grp-aside{margin:4px 0 10px;font-size:12px;font-weight:600}
.ui-root .grp-kv--rows{grid-template-columns:150px minmax(0,1fr);gap:0 14px;align-items:start}
.ui-root .grp-kv--rows dt,.ui-root .grp-kv--rows dd{padding:8px 0;border-bottom:1px solid var(--theme-border-subtle)}
.ui-root .grp-tbl{border:1px solid var(--theme-border)}
.ui-root .grp-tbl .ui-table th,.ui-root .grp-tbl .ui-table td{padding:8px 12px;vertical-align:middle}
.ui-root .grp-see{margin-left:8px}
.ui-root .grp-kids td{background:var(--theme-surface-subtle)}
.ui-root .grp-kid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--theme-border-subtle)}
.ui-root .grp-kid:last-child{border-bottom:none}
.ui-root .grp-kidh{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--theme-text-muted);border-bottom:1px solid var(--theme-border)}
.ui-root .grp-kid small{display:block}
.ui-root .grp-card{border:1px solid var(--theme-border);background:var(--theme-surface);padding:10px 12px;margin-bottom:8px}
.ui-root .grp-card .ui-check{display:flex;margin-top:6px}
.ui-root .grp-kidcard{display:flex;flex-direction:column;padding:6px 0;border-top:1px solid var(--theme-border-subtle)}
.ui-root .grp-acts{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
@media (max-width:640px){
.ui-root .grp-ua-row{grid-template-columns:minmax(0,1fr) auto}
.ui-root .grp-ua-row>div:first-child{grid-column:1 / -1;grid-row:1}
.ui-root .grp-ua-row .ui-cbx{grid-column:1;grid-row:2}
.ui-root .grp-ua-row .ui-btn{grid-column:2;grid-row:2}
.ui-root .grp-kv{grid-template-columns:minmax(0,1fr)}
}
`;
