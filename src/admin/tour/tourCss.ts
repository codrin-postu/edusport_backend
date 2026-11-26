/** Tour chrome: UI tokens only. The dim is the overlay colour at half strength (about 17% light, 30% dark), so the page stays readable; the card and strip take clicks even over a modal that blocks the page (pointer-events auto); the target gets a primary-colour outline. */
export const TOUR_CSS = `
.ui-root .tour-dim{position:fixed;inset:0;z-index:var(--ui-z-tour,100400);background:var(--theme-overlay);opacity:.5;pointer-events:none}
.ui-root .tour-outline{position:fixed;z-index:calc(var(--ui-z-tour,100400) + 1);border:2px solid var(--theme-primary);box-sizing:border-box;pointer-events:none;transition:all var(--ui-motion-fast) var(--ui-easing)}
.ui-root .tour-strip{pointer-events:auto;position:fixed;top:0;left:0;right:0;z-index:calc(var(--ui-z-tour,100400) + 3);padding:var(--ui-space-2) var(--ui-space-4);text-align:center;font-size:var(--ui-fs-body-sm);font-weight:600;background:var(--theme-primary);color:var(--theme-on-primary);font-family:var(--ui-font)}
.ui-root .tour-card{pointer-events:auto;position:fixed;z-index:calc(var(--ui-z-tour,100400) + 2);width:320px;box-sizing:border-box;padding:var(--ui-space-4);background:var(--theme-surface);color:var(--theme-text);border:1px solid var(--theme-border);box-shadow:var(--theme-shadow-md);font-family:var(--ui-font);font-size:var(--ui-fs-body);display:flex;flex-direction:column;gap:var(--ui-space-2)}
.ui-root .tour-card--sheet{left:0;right:0;bottom:0;width:auto;max-height:70vh;overflow:auto}
.ui-root .tour-head{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-2);color:var(--theme-primary)}
.ui-root .tour-where{font-size:var(--ui-fs-caption);color:var(--theme-text-muted)}
.ui-root .tour-title{margin:0;font-size:var(--ui-fs-section-title);font-weight:var(--ui-fw-section-title)}
.ui-root .tour-text{margin:0}
.ui-root .tour-action{margin:0;font-weight:600}
.ui-root .tour-guide{color:var(--theme-primary);font-size:var(--ui-fs-body-sm)}
.ui-root .tour-foot{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-2);margin-top:var(--ui-space-2)}
.ui-root .tour-pp-list{display:flex;flex-direction:column;gap:var(--ui-space-2)}
.ui-root .tour-pp-row{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-3);padding:var(--ui-space-3);border:1px solid var(--theme-border);background:var(--theme-surface)}
.ui-root .tour-pp-big{display:flex;align-items:center;gap:var(--ui-space-3);color:var(--theme-primary);margin-bottom:var(--ui-space-4)}
.ui-root .tour-pp-big span{color:var(--theme-text);font-weight:600}
`;
