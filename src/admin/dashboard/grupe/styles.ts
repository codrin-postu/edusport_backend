/**
 * CSS of Grupe and the group page (phase 4). Tokens only; no backtick inside the string; solid lines only; no pills
 * or circles (the count badge and the day toggles are square). The Sportivi CSS (SPORTIVI_CSS) is loaded alongside it.
 */
export const GRUPE_CSS = `
.ui-root .grp-head-acts{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.ui-root .grp-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:18px;padding:0 5px;margin-left:6px;font-size:11px;font-weight:700;border-radius:var(--ui-radius-sm);background:var(--theme-cat-eveniment);color:var(--theme-cat-eveniment-fg)}
.ui-root .grp-tabs{padding:0 18px}
.ui-root .grp-lines div+div{margin-top:2px}
.ui-root .grp-form{display:flex;flex-direction:column;gap:14px}
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
@media (max-width:640px){
.ui-root .grp-ua-row{grid-template-columns:minmax(0,1fr) auto}
.ui-root .grp-ua-row .ui-combo{grid-column:1 / -1;grid-row:2}
.ui-root .grp-kv{grid-template-columns:minmax(0,1fr)}
}
`;
