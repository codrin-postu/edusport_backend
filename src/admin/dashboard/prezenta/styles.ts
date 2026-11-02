/**
 * CSS of the Prezență screens (phase 5). Tokens only; no backtick inside the string; solid lines only; no pills or circles.
 * The Sportivi CSS (SPORTIVI_CSS) and the Grupe CSS (GRUPE_CSS) are loaded alongside it.
 */
export const PREZENTA_CSS = `
.ui-root .pz-tabs{padding:0 18px;overflow-x:auto;scrollbar-width:thin}
.ui-root .pz-tabs .ui-tab{white-space:nowrap;flex:none}
.ui-root .pz-notices{display:flex;flex-direction:column;gap:8px;padding:12px 18px 0}
.ui-root .pz-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:12px 18px;border-bottom:1px solid var(--theme-border)}
.ui-root .pz-head-slot{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ui-root .pz-head-slot .ui-input{width:auto}
.ui-root .pz-seg{display:inline-flex;border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);overflow:hidden;background:var(--theme-surface)}
.ui-root .pz-seg-btn{min-height:30px;padding:5px 12px;font:inherit;font-size:12.5px;font-weight:600;color:var(--theme-text-secondary);background:var(--theme-surface);border:none;border-right:1px solid var(--theme-border-strong);cursor:pointer}
.ui-root .pz-seg-btn:last-child{border-right:none}
.ui-root .pz-seg-btn:hover:not(:disabled):not(.pz-seg-label){background:var(--theme-surface-subtle);color:var(--theme-text)}
.ui-root .pz-seg-btn--on{background:var(--theme-primary-soft);color:var(--theme-primary)}
.ui-root .pz-seg-btn:disabled{color:var(--theme-text-muted);cursor:default}
.ui-root .pz-seg-btn:focus-visible{outline:2px solid var(--theme-focus);outline-offset:-2px}
.ui-root .pz-seg-label{display:inline-flex;align-items:center;min-width:120px;justify-content:center;cursor:default}
.ui-root .pz-bar-sp{flex:1}
.ui-root .pz-label{margin:0;padding:9px 18px 5px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--theme-text-secondary);background:var(--theme-surface-subtle);border-bottom:1px solid var(--theme-border)}
.ui-root .pz-label--warn{color:var(--theme-warning);background:var(--theme-warning-bg)}
.ui-root .pz-empty{margin:0;padding:16px 18px;color:var(--theme-text-muted)}
.ui-root .pz-sub{display:block;font-size:11.5px;color:var(--theme-text-muted)}
.ui-root .pz-state--nefacuta{color:var(--theme-warning);font-weight:600}
.ui-root .pz-lesson-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ui-root .pz-form{display:flex;flex-direction:column;gap:14px}
.ui-root .pz-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.ui-root .pz-coaches{display:flex;flex-direction:column;gap:8px}
.ui-root .pz-link{align-self:flex-start;font:inherit;font-size:12.5px;font-weight:600;color:var(--theme-primary);background:none;border:none;padding:0;cursor:pointer}
.ui-root .pz-link--danger{color:var(--theme-danger)}
.ui-root .pz-muted{color:var(--theme-text-muted)}
.ui-root .pz-link:disabled{color:var(--theme-text-muted);cursor:default}
.ui-root .pz-link:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
.ui-root .pz-sheet-sub{margin:0;font-size:12.5px;color:var(--theme-text-secondary)}
.ui-root .pz-tick{width:1%;text-align:center;white-space:nowrap}
.ui-root .pz-ticks .ui-table th,.ui-root .pz-ticks .ui-table td{padding:8px 10px;vertical-align:middle}
.ui-root .pz-ticks{border:1px solid var(--theme-border)}
.ui-root .pz-warn{color:var(--theme-warning);font-weight:600}
.ui-root .pz-visitor{display:flex;flex-direction:column;gap:8px}
.ui-root .pz-saved{margin:0;font-size:12px;color:var(--theme-text-muted)}
.ui-root .pz-hist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.ui-root .pz-hist li{padding:6px 0;border-bottom:1px solid var(--theme-border-subtle);font-size:12.5px;color:var(--theme-text)}
.ui-root .pz-foot{display:flex;align-items:center;gap:8px;width:100%}
.ui-root .pz-foot-count{margin-right:auto;font-weight:600;color:var(--theme-text)}
@media (max-width:640px){
.ui-root .pz-two{grid-template-columns:minmax(0,1fr)}
.ui-root .pz-bar-sp{display:none}
}
`;
