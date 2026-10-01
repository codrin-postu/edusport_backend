import { CALENDAR_CATEGORIES } from '../../../../../admin/ui';

/**
 * CSS of the admin calendar. Two scopes: `.cal` (the calendar, inside the
 * editor root, which also carries .ui-root) and `.cal-drawer` / `.cal-pop`
 * (the editor drawer and the phone filter popover, portalled to <body>).
 * Colours only from --theme-* (categories from --theme-cat-*), corners from
 * --ui-radius-*, so the calendar follows the light / dark admin theme.
 *
 * `data-calcat="<category>"` on an element sets three local channels from the
 * category tokens: --cal-c (solid fill), --cal-s (soft fill), --cal-sf (text
 * on the soft fill). Swatches, marks and event chips read them.
 */
const CAT = CALENDAR_CATEGORIES.map(
  (c) =>
    `.ui-root [data-calcat="${c}"]{--cal-c:var(--theme-cat-${c});--cal-s:var(--theme-cat-${c}-soft);--cal-sf:var(--theme-cat-${c}-soft-fg)}`,
).join('\n');

export const CAL_CSS = `
${CAT}
.cal{font-family:var(--ui-font);color:var(--theme-text)}
.cal-sw{width:10px;height:10px;border-radius:var(--ui-radius-sm);display:inline-block;flex-shrink:0;background:var(--cal-c)}
.cal-sw--lg{width:12px;height:12px}
.cal-st{font-size:var(--ui-fs-section-title);font-weight:var(--ui-fw-section-title);letter-spacing:var(--ui-ls-section-title);text-transform:uppercase;color:var(--theme-text-muted)}
.cal-opt{font-size:var(--ui-fs-caption);font-weight:400;color:var(--theme-text-muted)}
.cal-muted{color:var(--theme-text-muted)}
.cal-sp{flex:1}

/* frame, toolbar, filters */
.cal-frame{border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);background:var(--theme-surface);overflow:hidden}
.cal-bar{border-bottom:1px solid var(--theme-border)}
.cal-bar-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px}
.cal-bar-row--sub{padding-top:0}
.cal-bar-row--sub .cal-viewseg{flex:1;width:auto}
.cal-nav{display:flex;align-items:center;gap:6px}
.cal-mon{font-size:15px;font-weight:700;margin:0 4px;color:var(--theme-text);white-space:nowrap}
.cal-filters{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;border-top:1px solid var(--theme-border)}
.cal-filters--stack{flex-direction:column;align-items:stretch;padding:8px;border-top:none}
.cal-filter{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);background:var(--theme-surface);font-family:inherit;font-size:12px;font-weight:600;line-height:1.35;color:var(--theme-text-secondary);cursor:pointer;text-align:left}
.cal-filter:hover{border-color:var(--theme-border-strong);color:var(--theme-text)}
.cal-filter[aria-pressed="false"]{opacity:.45}
.cal-filter[aria-pressed="false"] .cal-filter-l{text-decoration:line-through}

/* month grid */
.cal-dows{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
.cal-dows div{text-align:center;font-size:var(--ui-fs-label);font-weight:var(--ui-fw-label);letter-spacing:var(--ui-ls-label);text-transform:uppercase;color:var(--theme-text-muted);padding:6px 0;border-bottom:1px solid var(--theme-border)}
.cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
.cal-day{min-height:88px;min-width:0;border-right:1px solid var(--theme-border-subtle);border-bottom:1px solid var(--theme-border-subtle);padding:4px;cursor:pointer;display:flex;flex-direction:column;gap:3px;background:var(--theme-surface)}
.cal-grid > :nth-child(7n){border-right:none}
.cal-day--we{background:var(--theme-surface-subtle)}
.cal-day--off{background:var(--theme-surface-sunken)}
.cal-day:hover{background:var(--theme-primary-soft)}
.cal-num{align-self:flex-start;min-width:20px;padding:0 5px;border:none;border-radius:var(--ui-radius-sm);background:none;font-family:inherit;font-size:12px;font-weight:600;line-height:18px;color:var(--theme-text-secondary);text-align:center;cursor:pointer}
.cal-day--off .cal-num{color:var(--theme-text-disabled)}
.cal-day--today .cal-num{background:var(--theme-primary);color:var(--theme-on-primary)}
.cal-more{align-self:flex-start;border:none;background:none;padding:0 5px;font-family:inherit;font-size:11px;font-weight:700;color:var(--theme-primary);cursor:pointer}
.cal-more:hover{text-decoration:underline}

/* an event: soft category tint, 3px category edge, dark text, time first */
.ui-root .cal-ev{display:block;width:100%;min-width:0;text-align:left;font-family:inherit;font-size:11px;font-weight:600;line-height:1.3;padding:2px 5px;border:none;border-left:3px solid var(--cal-c);border-radius:var(--ui-radius-sm);background:var(--cal-s);color:var(--cal-sf);cursor:pointer}
.ui-root .cal-ev b{font-weight:800}
.ui-root .cal-ev:hover{filter:brightness(.96)}
.ui-root .cal-ev:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
.ui-root .cal-ev--clamp .cal-ev-t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:normal;word-break:normal}
.ui-root .cal-ev--cancel .cal-ev-t{text-decoration:line-through}

/* phone month: compact days with colour marks */
.cal-month--compact .cal-day{min-height:44px;padding:3px;align-items:center;gap:3px;border-top:none;border-left:none;font-family:inherit;color:inherit;text-align:center}
.cal-month--compact .cal-num{cursor:inherit}
.cal-day--sel{outline:2px solid var(--theme-primary);outline-offset:-2px}
.cal-marks{display:flex;gap:2px}
.cal-marks i{width:6px;height:6px;border-radius:0;display:block;background:var(--cal-c)}
.cal-dayl{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-top:1px solid var(--theme-border)}
.cal-dayl .ui-btn{align-self:flex-start}

/* Listă */
.cal-list{display:flex;flex-direction:column}
.cal-wk{padding:6px 12px;background:var(--theme-surface-subtle);border-bottom:1px solid var(--theme-border);font-size:var(--ui-fs-label);font-weight:var(--ui-fw-label);letter-spacing:var(--ui-ls-label);text-transform:uppercase;color:var(--theme-text-muted)}
.cal-ag{display:flex;gap:10px;padding:8px 12px;border-bottom:1px solid var(--theme-border-subtle)}
.cal-ag-dd{width:44px;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:2px 4px;border:none;border-radius:var(--ui-radius-sm);background:none;font-family:inherit;color:var(--theme-text);cursor:pointer;text-align:left}
.cal-ag-dd:hover{background:var(--theme-primary-soft)}
.cal-ag-dd small{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--theme-text-muted)}
.cal-ag-n{font-size:15px;font-weight:700;line-height:1.1}
.cal-ag--today .cal-ag-n{padding:0 4px;border-radius:var(--ui-radius-sm);background:var(--theme-primary);color:var(--theme-on-primary)}
.cal-ag-l{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.cal-ag-l .cal-ev,.cal-dayl .cal-ev{font-size:12px;padding:4px 8px}

/* editor drawer */
.cal-drawer .cal-times{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:var(--ui-space-3);align-items:end}
.cal-drawer .cal-allday{padding-bottom:7px;white-space:nowrap}
.cal-drawer .cal-catsel{position:relative}
.cal-drawer .cal-catsel .cal-sw{position:absolute;left:10px;top:50%;margin-top:-5px;pointer-events:none}
.cal-drawer .cal-catsel .ui-input{padding-left:28px}
.cal-drawer .cal-days{display:flex;flex-wrap:wrap;gap:4px}
.cal-drawer .cal-dayt{min-width:32px;height:30px;padding:0 6px;border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);background:var(--theme-surface);color:var(--theme-text-secondary);font-family:inherit;font-size:var(--ui-fs-body-sm);font-weight:700;cursor:pointer}
.cal-drawer .cal-dayt:hover{border-color:var(--theme-primary);color:var(--theme-text)}
.cal-drawer .cal-dayt[aria-pressed="true"]{background:var(--theme-primary);border-color:var(--theme-primary);color:var(--theme-on-primary)}
.cal-drawer .cal-date{padding-top:14px}
.cal-drawer .cal-stack{display:flex;flex-direction:column;gap:var(--ui-space-3);min-width:0}
.cal-drawer .cal-img{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.cal-drawer .cal-thumb{width:56px;height:34px;border-radius:var(--ui-radius-sm);background:var(--theme-surface-sunken) center/cover no-repeat;border:1px solid var(--theme-border);flex-shrink:0}
.cal-drawer .cal-exsum{display:flex;align-items:center;gap:8px;min-width:0}
.cal-drawer .cal-chg{font-size:var(--ui-fs-body-sm);min-width:0;overflow:hidden;text-overflow:ellipsis}
.cal-drawer .cal-err{flex-basis:100%}
.cal-drawer .ui-btn.cal-del{color:var(--theme-danger);padding-left:6px;padding-right:6px}
.cal-drawer .ui-btn.cal-del:hover:not(:disabled){background:var(--theme-danger-bg);color:var(--theme-danger)}
.cal-drawer .cal-save{min-width:110px}
/* Școala series dates: one row per date, months as sticky subheaders */
.cal-drawer .cal-dt{position:relative;max-height:340px;overflow-y:auto;border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);background:var(--theme-surface)}
.cal-drawer .cal-dt-sub{position:sticky;top:0;z-index:1;padding:5px 10px;background:var(--theme-surface-subtle);border-bottom:1px solid var(--theme-border);font-size:var(--ui-fs-label);font-weight:var(--ui-fw-label);letter-spacing:var(--ui-ls-label);text-transform:uppercase;color:var(--theme-text-muted)}
.cal-drawer .cal-dt-row{display:grid;grid-template-columns:minmax(0,1fr) 108px;gap:6px 8px;align-items:center;padding:5px 10px;border-bottom:1px solid var(--theme-border-subtle);font-size:var(--ui-fs-body-sm)}
.cal-drawer .cal-dt-row:last-child{border-bottom:none}
.cal-drawer .cal-dt-date{display:flex;align-items:center;gap:7px;min-width:0}
.cal-drawer .cal-dt-row--past{color:var(--theme-text-muted)}
.cal-drawer .cal-dt-row--cur{background:var(--theme-primary-soft)}
.cal-drawer .cal-dt-note{grid-column:1 / -1}
.cal-drawer .cal-dt-state,.cal-drawer .cal-dt-note{padding-top:3px;padding-bottom:3px;font-size:var(--ui-fs-body-sm)}

/* phone filter popover */
.cal-pop{min-width:240px}

@media (max-width:900px){
  .cal-day{min-height:76px}
}
@media (max-width:640px){
  .cal-bar-row{padding:8px}
  .cal-mon{font-size:14px}
  .cal-month--compact .cal-day{min-height:44px}
  .cal-drawer .cal-times{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .cal-drawer .cal-allday{grid-column:1 / -1;padding-bottom:0}
  .cal-drawer .cal-cancel{display:none}
  .cal-drawer .cal-save{flex:1}
}
`;
