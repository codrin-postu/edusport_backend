import { tokensCss } from './tokens';
import { startAdminThemeSync } from './useAdminTheme';

/**
 * Stylesheet for the shared admin components (src/admin/ui).
 *
 * Rules:
 *   - every value comes from a custom property generated from ./tokens.ts:
 *     colours only from var(--theme-*) (or, rarely, var(--palette-*)),
 *     everything else from var(--ui-*); no raw colours here
 *     (scripts/admin-ui-check.mjs enforces it);
 *   - every class is prefixed `ui-` and scoped under `.ui-root`, so it never
 *     collides with the legacy `.eduf`, `.insp` or page-local classes, and it
 *     wins over `.eduf input` style element selectors while pages migrate;
 *   - square corners only (radius sm / md), no dashed borders.
 *
 * `.ui-root` is set by every surface we render: AdminPage, the Modal,
 * Popover and Toast portals, the save bar, and the component roots that also
 * live inside content-manager fields. The --theme-* and --ui-* variables are
 * defined on `.ui-root` only (see tokensCss in ./tokens.ts), so nothing leaks
 * into Strapi's own UI. `.ui-root` also opts every button inside out of the
 * global SaveBar tagger in app.tsx.
 *
 * Kept free of backticks inside the CSS on purpose: one stray backtick in a
 * template literal takes the whole admin panel down to a blank page.
 */

const R = '.ui-root';
const SB = '.ui-root.ui-savebar';

/** Phone bottom-sheet layout of the save bar, under `wrap` (a media query) or bare. */
function sheet(sel: string, wrap: string): string {
  const rules =
    `${sel}{left:0;right:0;bottom:0;width:100%;min-width:0;max-width:none;gap:8px;padding:12px 14px;padding-bottom:max(12px, env(safe-area-inset-bottom));border-radius:var(--ui-radius-savebar-sheet);transform:translateY(110%)}` +
    `${sel}[data-visible="true"]{transform:translateY(0)}` +
    `${sel} .ui-savebar-btn{padding:8px 12px}` +
    `${sel} .ui-savebar-btn--primary,${sel} .ui-savebar-btn--success,${sel} .ui-savebar-btn--danger{padding:8px 16px}`;
  return wrap ? `${wrap}{${rules}}` : rules;
}

export const UI_CSS = `
${R}{font-family:var(--ui-font);font-size:var(--ui-fs-body);line-height:var(--ui-lh-body);color:var(--theme-text);color-scheme:var(--theme-color-scheme)}
${R} *,${R} *::before,${R} *::after{box-sizing:border-box}
${R} :focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
${R} a{color:var(--theme-primary);text-decoration:none}
${R} a:hover{text-decoration:underline}
${R} .ui-num{font-variant-numeric:tabular-nums}
${R} .ui-muted{color:var(--theme-text-muted)}
${R} .ui-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

/* page root. flex-shrink:0: Strapi renders plugin pages inside a fixed-height
   flex column; without it the background stops after the first screen. */
.ui-root.ui-page{background:var(--theme-bg);min-height:100%;flex-shrink:0;padding:var(--ui-space-5)}
@media (max-width:640px){.ui-root.ui-page{padding:var(--ui-space-3)}}
${R} .ui-stack{display:flex;flex-direction:column;gap:var(--ui-space-4)}

/* window */
${R} .ui-win{background:var(--theme-surface);border:1px solid var(--theme-border);border-radius:var(--ui-radius-md);box-shadow:var(--theme-shadow-sm);overflow:clip}

/* page header */
${R} .ui-ph{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--ui-space-4);padding:var(--ui-space-4) 18px;border-bottom:1px solid var(--theme-border)}
${R} .ui-ph-back{display:inline-flex;align-items:center;gap:var(--ui-space-1);font-size:var(--ui-fs-caption);font-weight:600;color:var(--theme-text-muted);margin-bottom:var(--ui-space-1);background:none;border:none;padding:0;cursor:pointer;font-family:inherit}
${R} .ui-ph-back:hover{color:var(--theme-primary);text-decoration:none}
${R} .ui-ph-title{margin:0;font-size:var(--ui-fs-page-title);font-weight:var(--ui-fw-page-title);line-height:var(--ui-lh-page-title);letter-spacing:var(--ui-ls-page-title);color:var(--theme-text)}
${R} .ui-ph-sub{margin:3px 0 0;font-size:var(--ui-fs-body-sm);color:var(--theme-text-muted)}
${R} .ui-ph-actions{display:flex;align-items:center;gap:var(--ui-space-2);flex-shrink:0;flex-wrap:wrap;justify-content:flex-end}
@media (max-width:640px){${R} .ui-ph{flex-direction:column}${R} .ui-ph-actions{justify-content:flex-start}}

/* buttons */
${R} .ui-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;font-size:var(--ui-fs-body-sm);font-weight:600;line-height:1.2;padding:7px 12px;border-radius:var(--ui-radius-sm);border:1px solid var(--theme-border-strong);background:var(--theme-surface);color:var(--theme-text);cursor:pointer;white-space:nowrap;transition:background-color var(--ui-motion-fast) var(--ui-easing),border-color var(--ui-motion-fast) var(--ui-easing),color var(--ui-motion-fast) var(--ui-easing)}
${R} .ui-btn:hover:not(:disabled){background:var(--theme-surface-subtle);border-color:var(--theme-text-muted)}
${R} .ui-btn--primary{background:var(--theme-primary);border-color:var(--theme-primary);color:var(--theme-on-primary)}
${R} .ui-btn--primary:hover:not(:disabled){background:var(--theme-primary-hover);border-color:var(--theme-primary-hover)}
${R} .ui-btn--danger{color:var(--theme-danger);border-color:var(--theme-danger-border);background:var(--theme-surface)}
${R} .ui-btn--danger:hover:not(:disabled){background:var(--theme-danger-bg);border-color:var(--theme-danger)}
${R} .ui-btn--danger.ui-btn--solid{background:var(--theme-danger);border-color:var(--theme-danger);color:var(--theme-surface)}
${R} .ui-btn--danger.ui-btn--solid:hover:not(:disabled){background:var(--theme-danger);border-color:var(--theme-danger);filter:brightness(.92)}
${R} .ui-btn--ghost{background:transparent;border-color:transparent;color:var(--theme-text-secondary)}
${R} .ui-btn--ghost:hover:not(:disabled){background:var(--theme-primary-soft);border-color:transparent;color:var(--theme-primary)}
${R} .ui-btn--sm{padding:5px 9px;font-size:12px}
${R} .ui-btn--icon{padding:7px}
${R} .ui-btn--icon.ui-btn--sm{padding:5px}
${R} .ui-btn:disabled{opacity:.55;cursor:default}
${R} .ui-btn[aria-busy="true"]{cursor:progress}
${R} .ui-btn svg{width:14px;height:14px;flex-shrink:0}

/* status badge */
${R} .ui-badge{display:inline-flex;align-items:center;gap:4px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border:1px solid var(--ui-badge-border);color:var(--ui-badge-fg);background:var(--ui-badge-bg);border-radius:var(--ui-radius-sm);white-space:nowrap;line-height:1.3}
${R} .ui-badge--sm{font-size:10px;padding:1px 5px}
${R} .ui-badge--md{font-size:11px;padding:3px 7px}
${R} .ui-badge--success{--ui-badge-fg:var(--theme-success);--ui-badge-bg:var(--theme-success-bg);--ui-badge-border:var(--theme-success-border)}
${R} .ui-badge--warning{--ui-badge-fg:var(--theme-warning);--ui-badge-bg:var(--theme-warning-bg);--ui-badge-border:var(--theme-warning-border)}
${R} .ui-badge--danger{--ui-badge-fg:var(--theme-danger);--ui-badge-bg:var(--theme-danger-bg);--ui-badge-border:var(--theme-danger-border)}
${R} .ui-badge--info{--ui-badge-fg:var(--theme-info);--ui-badge-bg:var(--theme-info-bg);--ui-badge-border:var(--theme-info-border)}
${R} .ui-badge--neutral{--ui-badge-fg:var(--theme-neutral);--ui-badge-bg:var(--theme-neutral-bg);--ui-badge-border:var(--theme-neutral-border)}
${R} .ui-badge--primary{--ui-badge-fg:var(--theme-primary);--ui-badge-bg:var(--theme-primary-soft);--ui-badge-border:var(--theme-primary-soft-line)}

/* chip */
${R} .ui-chip{display:inline-flex;align-items:center;gap:6px;background:var(--theme-primary-soft);color:var(--theme-primary);border:1px solid var(--theme-primary-soft-line);border-radius:var(--ui-radius-sm);padding:3px 4px 3px 8px;font-size:12px;font-weight:600;line-height:1.35;max-width:100%}
${R} .ui-chip-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${R} .ui-chip-x{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border:none;background:none;color:inherit;cursor:pointer;padding:0;border-radius:var(--ui-radius-sm);opacity:.75;font-family:inherit;font-size:13px;line-height:1}
${R} .ui-chip-x:hover{opacity:1;background:var(--theme-primary-soft-line)}
${R} .ui-chip--static{padding-right:8px}
${R} .ui-chips{display:flex;flex-wrap:wrap;gap:6px}

/* switch */
${R} .ui-switch{display:inline-flex;align-items:center;gap:9px;background:none;border:none;padding:2px 0;font-family:inherit;font-size:var(--ui-fs-body);color:var(--theme-text);cursor:pointer;text-align:left}
${R} .ui-switch-track{position:relative;flex-shrink:0;width:32px;height:18px;border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);background:var(--theme-surface-sunken);transition:background-color var(--ui-motion-fast) var(--ui-easing),border-color var(--ui-motion-fast) var(--ui-easing)}
${R} .ui-switch-thumb{position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:var(--ui-radius-sm);background:var(--theme-text-muted);transition:transform var(--ui-motion-fast) var(--ui-easing),background-color var(--ui-motion-fast) var(--ui-easing)}
${R} .ui-switch[aria-checked="true"] .ui-switch-track{background:var(--theme-primary);border-color:var(--theme-primary)}
${R} .ui-switch[aria-checked="true"] .ui-switch-thumb{transform:translateX(14px);background:var(--theme-on-primary)}
${R} .ui-switch:disabled{opacity:.55;cursor:default}
${R} .ui-switch-text{display:flex;flex-direction:column}
${R} .ui-switch-desc{font-size:var(--ui-fs-caption);color:var(--theme-text-muted)}

/* checkbox */
${R} .ui-check{display:inline-flex;align-items:flex-start;gap:8px;font-size:var(--ui-fs-body);cursor:pointer;user-select:none;color:var(--theme-text)}
${R} .ui-check input{appearance:none;-webkit-appearance:none;margin:2px 0 0;flex-shrink:0;width:16px;height:16px;border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);background:var(--theme-surface);display:inline-grid;place-content:center;cursor:pointer;transition:background-color var(--ui-motion-fast) var(--ui-easing)}
${R} .ui-check input::before{content:"";width:9px;height:5px;border-left:2px solid var(--theme-on-primary);border-bottom:2px solid var(--theme-on-primary);transform:translateY(-1px) rotate(-45deg);opacity:0}
${R} .ui-check input:checked{background:var(--theme-primary);border-color:var(--theme-primary)}
${R} .ui-check input:checked::before{opacity:1}
${R} .ui-check input:indeterminate{background:var(--theme-primary);border-color:var(--theme-primary)}
${R} .ui-check input:indeterminate::before{opacity:1;border-left:none;transform:none;height:0;width:8px}
${R} .ui-check input:disabled{opacity:.55;cursor:default}
${R} .ui-check--disabled{cursor:default;color:var(--theme-text-disabled)}

/* fields */
${R} .ui-field{display:flex;flex-direction:column;gap:4px;min-width:0}
${R} .ui-label{font-size:var(--ui-fs-label);font-weight:var(--ui-fw-label);letter-spacing:var(--ui-ls-label);text-transform:uppercase;color:var(--theme-text-muted)}
${R} .ui-req{color:var(--theme-danger);margin-left:3px}
${R} .ui-hint{font-size:var(--ui-fs-caption);color:var(--theme-text-muted);line-height:var(--ui-lh-caption)}
${R} .ui-error{font-size:var(--ui-fs-caption);color:var(--theme-danger);font-weight:600;line-height:var(--ui-lh-caption)}
${R} .ui-input{width:100%;font-family:inherit;font-size:var(--ui-fs-body);line-height:1.4;color:var(--theme-text);background:var(--theme-surface-sunken);border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);padding:7px 9px;transition:border-color var(--ui-motion-fast) var(--ui-easing)}
${R} .ui-input::placeholder{color:var(--theme-text-muted);opacity:1}
${R} .ui-input:focus{outline:none;border-color:var(--theme-primary);box-shadow:0 0 0 1px var(--theme-primary)}
${R} .ui-input:disabled{color:var(--theme-text-disabled);cursor:not-allowed}
${R} .ui-input[aria-invalid="true"]{border-color:var(--theme-danger)}
${R} textarea.ui-input{resize:vertical;min-height:64px}
${R} select.ui-input{padding-right:6px}
${R} .ui-grid2{display:grid;grid-template-columns:1fr 1fr;gap:var(--ui-space-3)}
@media (max-width:640px){${R} .ui-grid2{grid-template-columns:1fr}}

/* section */
${R} .ui-sec{border:1px solid var(--theme-border);border-radius:var(--ui-radius-md);background:var(--theme-surface)}
${R} .ui-sec-h{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-2);padding:10px 13px;border-bottom:1px solid var(--theme-border)}
${R} .ui-sec-title{margin:0;font-size:var(--ui-fs-section-title);font-weight:var(--ui-fw-section-title);letter-spacing:var(--ui-ls-section-title);text-transform:uppercase;color:var(--theme-text-muted)}
${R} .ui-sec-b{padding:13px;display:flex;flex-direction:column;gap:var(--ui-space-3)}
${R} .ui-sec-f{display:flex;align-items:center;gap:var(--ui-space-2);padding:10px 13px;border-top:1px solid var(--theme-border);background:var(--theme-surface-subtle)}

/* two column: rail + body */
${R} .ui-two{display:grid;grid-template-columns:var(--ui-rail-w,280px) minmax(0,1fr);align-items:start}
${R} .ui-rail{border-right:1px solid var(--theme-border);padding:var(--ui-space-4) 18px;background:var(--theme-surface-subtle);align-self:stretch}
${R} .ui-body{padding:var(--ui-space-4) 18px;display:flex;flex-direction:column;gap:14px;min-width:0}
@media (max-width:900px){${R} .ui-two{grid-template-columns:1fr}${R} .ui-rail{border-right:none;border-bottom:1px solid var(--theme-border)}}

/* save bar (SaveBarView): the floating, Strapi-matching bar used by the
   native content-manager pages (src/admin/SaveBar.tsx) and by every custom
   page (ui/SaveBar.tsx). Its root carries .ui-root itself, because the global
   bar mounts outside any AdminPage. The 8px bar, the sheet's 12px top corners
   and the round status dot are the approved exception to the square rule. */
${SB}{position:fixed;z-index:9999;left:50%;bottom:16px;display:flex;align-items:center;gap:14px;padding:10px 12px 10px 16px;min-width:360px;max-width:720px;box-sizing:border-box;background:var(--theme-savebar-surface);color:var(--theme-savebar-text);border:1px solid var(--theme-savebar-line);border-radius:var(--ui-radius-savebar);box-shadow:var(--theme-savebar-shadow);font-family:var(--ui-font);font-size:14px;transform:translate(-50%,110%);opacity:0;transition:transform 140ms ease-in,opacity 140ms ease-in}
${SB}[data-visible="true"]{transform:translate(-50%,0);opacity:1;transition:transform 180ms cubic-bezier(0.2,0.8,0.2,1),opacity 180ms ease-out}
${SB} .ui-savebar-icon{width:18px;height:18px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;border-radius:var(--ui-radius-savebar-dot);background:var(--theme-savebar-warning);color:var(--theme-savebar-on-icon);font-size:12px;font-weight:700;line-height:1}
${SB} .ui-savebar-icon[data-tone="success"]{background:var(--theme-savebar-success)}
${SB} .ui-savebar-icon[data-tone="danger"]{background:var(--theme-savebar-danger)}
${SB} .ui-savebar-label{flex:1;min-width:0;color:var(--theme-savebar-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${SB} .ui-savebar-extra{display:flex;align-items:center;gap:8px;flex-shrink:0}
${SB} .ui-savebar-btn{display:inline-flex;align-items:center;gap:8px;flex-shrink:0;padding:6px 12px;border:1px solid var(--theme-savebar-line);border-radius:var(--ui-radius-md);background:transparent;color:var(--theme-savebar-text);font-family:inherit;font-size:13px;font-weight:500;line-height:normal;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s}
${SB} .ui-savebar-btn:hover:not(:disabled){background:var(--theme-savebar-surface-hover);border-color:var(--theme-savebar-line-hover)}
${SB} .ui-savebar-btn:disabled{cursor:not-allowed;opacity:.5}
${SB} .ui-savebar-btn--primary,${SB} .ui-savebar-btn--success,${SB} .ui-savebar-btn--danger{padding:6px 14px;border:none;font-weight:600;color:var(--theme-savebar-on-primary);background:var(--theme-savebar-primary);transition:background .15s}
${SB} .ui-savebar-btn--primary:hover:not(:disabled){background:var(--theme-savebar-primary-hover)}
${SB} .ui-savebar-btn--success{background:var(--theme-savebar-success);color:var(--theme-savebar-on-success)}
${SB} .ui-savebar-btn--success:hover:not(:disabled){background:var(--theme-savebar-success-hover)}
${SB} .ui-savebar-btn--danger,${SB} .ui-savebar-btn--danger:hover:not(:disabled){background:var(--theme-savebar-danger)}
${SB} .ui-savebar-btn--primary:disabled{opacity:.55;cursor:default}
${SB} .ui-savebar-btn--primary[aria-busy="true"]{opacity:1;cursor:progress}
${SB} :focus-visible{outline-color:var(--theme-savebar-line-hover)}
${SB} .ui-savebar-spin{display:inline-block;flex-shrink:0;width:12px;height:12px;border:2px solid currentColor;border-top-color:transparent;border-radius:var(--ui-radius-savebar-dot);animation:ui-spin .7s linear infinite}
${sheet(SB + ':not(.ui-savebar--inline)', '@media (max-width:640px)')}
${sheet(SB + '.ui-savebar--sheet', '')}
${R} .ui-savebar-spacer{height:72px;flex-shrink:0}
/* in-place rendering for the reference page: no fixed position, no slide */
${SB}.ui-savebar--inline{position:relative;left:auto;bottom:auto;z-index:auto;display:inline-flex;vertical-align:top;transform:none;opacity:1;transition:none}
${SB}.ui-savebar--inline.ui-savebar--sheet{display:flex}
@media (prefers-reduced-motion:reduce){${SB}{transition:none}${SB} .ui-savebar-spin{animation-duration:2.4s}}

/* notice */
${R} .ui-notice{display:flex;align-items:flex-start;gap:var(--ui-space-3);font-size:var(--ui-fs-body-sm);color:var(--theme-text);background:var(--ui-notice-bg);border:1px solid var(--ui-notice-border);border-radius:var(--ui-radius-sm);padding:10px 12px}
${R} .ui-notice-mark{width:3px;align-self:stretch;flex-shrink:0;background:var(--ui-notice-fg)}
${R} .ui-notice-text{flex:1;line-height:1.45;min-width:0}
${R} .ui-notice-title{display:block;font-weight:700;color:var(--ui-notice-fg);margin-bottom:1px}
${R} .ui-notice-body{color:var(--theme-text-secondary)}
${R} .ui-notice-action{flex-shrink:0;align-self:center}
${R} .ui-notice--success{--ui-notice-fg:var(--theme-success);--ui-notice-bg:var(--theme-success-bg);--ui-notice-border:var(--theme-success-border)}
${R} .ui-notice--warning{--ui-notice-fg:var(--theme-warning);--ui-notice-bg:var(--theme-warning-bg);--ui-notice-border:var(--theme-warning-border)}
${R} .ui-notice--danger{--ui-notice-fg:var(--theme-danger);--ui-notice-bg:var(--theme-danger-bg);--ui-notice-border:var(--theme-danger-border)}
${R} .ui-notice--info{--ui-notice-fg:var(--theme-info);--ui-notice-bg:var(--theme-info-bg);--ui-notice-border:var(--theme-info-border)}

/* empty state + spinner */
${R} .ui-empty{display:flex;flex-direction:column;align-items:center;gap:var(--ui-space-3);padding:44px var(--ui-space-4);text-align:center;color:var(--theme-text-muted);font-size:var(--ui-fs-body)}
${R} .ui-empty-icon{color:var(--theme-text-disabled)}
${R} .ui-empty-icon svg{width:28px;height:28px}
${R} .ui-spinner{display:inline-block;flex-shrink:0;color:var(--theme-primary);animation:ui-spin .8s linear infinite}
${R} .ui-btn .ui-spinner{color:currentColor}
@keyframes ui-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){${R} .ui-spinner{animation-duration:2.4s}}
${R} .ui-loading{display:flex;align-items:center;justify-content:center;gap:8px;padding:44px var(--ui-space-4);color:var(--theme-text-muted);font-size:var(--ui-fs-body)}

/* modal (portal root carries .ui-root) */
.ui-root.ui-modal-layer{position:fixed;inset:0;z-index:var(--ui-modal-z,400);display:flex;align-items:center;justify-content:center;padding:var(--ui-space-4);background:var(--theme-overlay)}
${R} .ui-modal{width:var(--ui-modal-w,460px);max-width:100%;max-height:86vh;display:flex;flex-direction:column;background:var(--theme-surface);border:1px solid var(--theme-border);border-radius:var(--ui-radius-md);box-shadow:var(--theme-shadow-md);overflow:hidden;color:var(--theme-text)}
${R} .ui-modal:focus{outline:none}
${R} .ui-modal--md{--ui-modal-w:600px}
${R} .ui-modal--lg{--ui-modal-w:720px}
${R} .ui-modal-h{display:flex;align-items:center;gap:10px;padding:13px 15px;border-bottom:1px solid var(--theme-border)}
${R} .ui-modal-title{margin:0;font-size:14px;font-weight:700;flex-shrink:0}
${R} .ui-modal-extra{flex:1;display:flex;align-items:center;gap:8px;justify-content:flex-end;min-width:0}
${R} .ui-modal-b{padding:14px 15px;overflow-y:auto;font-size:var(--ui-fs-body-sm);color:var(--theme-text-secondary);line-height:1.5}
${R} .ui-modal-f{display:flex;gap:10px;justify-content:flex-end;padding:12px 15px;border-top:1px solid var(--theme-border);background:var(--theme-surface-subtle)}

/* tabs */
${R} .ui-tabs{display:flex;gap:2px;border-bottom:1px solid var(--theme-border);overflow-x:auto}
${R} .ui-tab{display:inline-flex;align-items:center;gap:6px;font-family:inherit;font-size:var(--ui-fs-body-sm);font-weight:600;color:var(--theme-text-muted);background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-1px;padding:9px 12px;cursor:pointer;white-space:nowrap}
${R} .ui-tab:hover{color:var(--theme-text)}
${R} .ui-tab[aria-selected="true"]{color:var(--theme-primary);border-bottom-color:var(--theme-primary)}
${R} .ui-tab-count{font-size:10.5px;font-weight:700;color:var(--theme-text-muted);background:var(--theme-neutral-bg);border-radius:var(--ui-radius-sm);padding:0 5px}
${R} .ui-tab[aria-selected="true"] .ui-tab-count{color:var(--theme-primary);background:var(--theme-primary-soft)}

/* pager */
${R} .ui-pager{display:flex;align-items:center;gap:var(--ui-space-3);flex-wrap:wrap;font-size:12px;color:var(--theme-text-muted)}
${R} .ui-pager-range{flex:1}
${R} .ui-pager-pages{display:flex;align-items:center;gap:4px;margin-left:auto}
${R} .ui-pg{min-width:28px;height:28px;padding:0 7px;font-family:inherit;font-size:12px;font-weight:600;color:var(--theme-text-secondary);background:var(--theme-surface);border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);cursor:pointer}
${R} .ui-pg:hover:not(:disabled){border-color:var(--theme-border-strong)}
${R} .ui-pg[aria-current="page"]{background:var(--theme-primary);border-color:var(--theme-primary);color:var(--theme-on-primary)}
${R} .ui-pg:disabled{opacity:.45;cursor:default}
${R} .ui-pg-gap{min-width:16px;text-align:center}
${R} .ui-confirm-typed .ui-label{text-transform:none;letter-spacing:0;font-size:var(--ui-fs-body-sm);font-weight:600;color:var(--theme-text)}

/* data table */
${R} .ui-table-bar{display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid var(--theme-border);flex-wrap:wrap}
${R} .ui-table-search{flex:1;min-width:200px;max-width:420px}
${R} .ui-table-wrap{overflow-x:auto}
${R} .ui-table{border-collapse:collapse;width:100%;font-size:var(--ui-fs-body)}
${R} .ui-table th{text-align:left;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--theme-text-muted);font-weight:700;padding:10px 14px;border-bottom:1px solid var(--theme-border);white-space:nowrap}
${R} .ui-table th button{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
${R} .ui-table th button:hover{color:var(--theme-text)}
${R} .ui-table th button:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}
${R} .ui-table th[aria-sort="ascending"],${R} .ui-table th[aria-sort="descending"]{color:var(--theme-primary)}
${R} .ui-table td{padding:10px 14px;border-bottom:1px solid var(--theme-border-subtle);vertical-align:middle}
${R} .ui-table tbody tr.ui-table-click{cursor:pointer}
${R} .ui-table tbody tr.ui-table-click:hover td{background:var(--theme-surface-subtle)}
${R} .ui-table-pager{padding:11px 18px;border-top:1px solid var(--theme-border)}
${R} .ui-table-sort{font-size:9px;opacity:.8}

/* image picker */
${R} .ui-imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
${R} .ui-img{position:relative;padding:5px;border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);background:var(--theme-surface);cursor:pointer;font-family:inherit;text-align:left}
${R} .ui-img:hover{border-color:var(--theme-primary)}
${R} .ui-img[aria-pressed="true"]{border-color:var(--theme-primary);box-shadow:0 0 0 1px var(--theme-primary)}
${R} .ui-img-pv{width:100%;aspect-ratio:1/1;background:var(--theme-surface-sunken) center/cover no-repeat;border-radius:var(--ui-radius-sm)}
${R} .ui-img-name{font-size:11px;color:var(--theme-text-muted);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${R} .ui-img-tick{position:absolute;top:8px;right:8px;display:none;padding:1px 5px;font-size:10px;font-weight:700;background:var(--theme-primary);color:var(--theme-on-primary);border-radius:var(--ui-radius-sm)}
${R} .ui-img[aria-pressed="true"] .ui-img-tick{display:block}

/* inbox: list + reader */
${R} .ui-inbox{display:grid;grid-template-columns:var(--ui-inbox-list-w,360px) minmax(0,1fr);min-height:480px}
${R} .ui-inbox-list{border-right:1px solid var(--theme-border);display:flex;flex-direction:column;min-width:0}
${R} .ui-inbox-items{flex:1;overflow-y:auto}
${R} .ui-inbox-item{display:block;width:100%;text-align:left;font-family:inherit;font-size:var(--ui-fs-body-sm);color:var(--theme-text);background:none;border:none;border-bottom:1px solid var(--theme-border-subtle);padding:10px 14px;cursor:pointer}
${R} .ui-inbox-item:hover{background:var(--theme-surface-subtle)}
${R} .ui-inbox-item[aria-current="true"]{background:var(--theme-primary-soft);box-shadow:inset 3px 0 0 var(--theme-primary)}
${R} .ui-inbox-reader{min-width:0;padding:var(--ui-space-4) 18px}
${R} .ui-inbox-back{display:none}
${R} .ui-inbox-group{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--theme-text-muted);padding:10px 14px 6px;background:var(--theme-surface-subtle);border-bottom:1px solid var(--theme-border-subtle)}
${R} .ui-inbox-pager{padding:10px 14px;border-top:1px solid var(--theme-border)}
${R} .ui-inbox-head{display:flex;flex-direction:column;gap:var(--ui-space-3);padding:var(--ui-space-3) 18px 0}
${R} .ui-inbox-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:var(--ui-space-3) 18px;border-bottom:1px solid var(--theme-border)}
@media (max-width:900px){${R} .ui-inbox{grid-template-columns:1fr}${R} .ui-inbox-list{border-right:none}${R} .ui-inbox[data-open="true"] .ui-inbox-list{display:none}${R} .ui-inbox[data-open="false"] .ui-inbox-reader{display:none}${R} .ui-inbox-back{display:inline-flex;margin-bottom:var(--ui-space-3)}}

/* shared small icon button (rows, tiles, combobox) */
${R} .ui-iconbtn{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:28px;height:28px;padding:0;border:1px solid transparent;border-radius:var(--ui-radius-sm);background:none;color:var(--theme-text-muted);cursor:pointer;font-family:inherit}
${R} .ui-iconbtn:hover:not(:disabled){background:var(--theme-surface-subtle);border-color:var(--theme-border);color:var(--theme-text)}
${R} .ui-iconbtn--danger:hover:not(:disabled){background:var(--theme-danger-bg);border-color:var(--theme-danger-border);color:var(--theme-danger)}
${R} .ui-iconbtn--sm{width:22px;height:22px}
${R} .ui-iconbtn:disabled{opacity:.4;cursor:default}
${R} .ui-iconbtn svg{flex-shrink:0}
${R} a.ui-btn:hover{text-decoration:none}

/* add button: full-width "+ label" at the end of a list */
${R} .ui-add{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:9px 14px;border:1px solid var(--theme-primary-soft-line);border-radius:var(--ui-radius-sm);background:var(--theme-surface);color:var(--theme-primary);font-family:inherit;font-size:var(--ui-fs-body-sm);font-weight:600;line-height:1.2;cursor:pointer;transition:background-color var(--ui-motion-fast) var(--ui-easing),border-color var(--ui-motion-fast) var(--ui-easing)}
${R} .ui-add:hover:not(:disabled){background:var(--theme-primary-soft);border-color:var(--theme-primary)}
${R} .ui-add:disabled{opacity:.55;cursor:default}

/* repeatable list + expandable row */
.ui-root.ui-rl{display:flex;flex-direction:column;gap:var(--ui-space-2)}
${R} .ui-rl-items{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--ui-space-2)}
${R} .ui-rl-empty{padding:14px;text-align:center;color:var(--theme-text-muted);font-size:var(--ui-fs-body-sm);background:var(--theme-surface-subtle);border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm)}
${R} .ui-row{position:relative;border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);background:var(--theme-surface);transition:opacity var(--ui-motion-fast) var(--ui-easing)}
${R} .ui-row--open{border-color:var(--theme-border-strong)}
${R} .ui-row[data-dragging="true"]{opacity:.45}
${R} [data-drop="before"]{box-shadow:0 -3px 0 0 var(--theme-primary)}
${R} [data-drop="after"]{box-shadow:0 3px 0 0 var(--theme-primary)}
${R} .ui-gal [data-drop="before"]{box-shadow:-3px 0 0 0 var(--theme-primary)}
${R} .ui-gal [data-drop="after"]{box-shadow:3px 0 0 0 var(--theme-primary)}
${R} [data-drop="on"]{box-shadow:0 0 0 2px var(--theme-primary)}
${R} .ui-row-h{display:flex;align-items:center;gap:4px;padding:5px 6px}
${R} .ui-row-toggle{flex:1;min-width:0;display:flex;align-items:center;gap:8px;padding:5px 6px;border:none;background:none;border-radius:var(--ui-radius-sm);font-family:inherit;font-size:var(--ui-fs-body);font-weight:600;color:var(--theme-text);text-align:left;cursor:pointer}
${R} .ui-row-toggle:hover{background:var(--theme-surface-subtle)}
${R} .ui-row-summary{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${R} .ui-row-chev{display:inline-flex;color:var(--theme-text-muted);transition:transform var(--ui-motion-fast) var(--ui-easing)}
${R} .ui-row-toggle[aria-expanded="true"] .ui-row-chev{transform:rotate(180deg)}
${R} .ui-row-actions{display:flex;align-items:center;gap:2px;flex-shrink:0}
${R} .ui-row-b{padding:12px 13px 13px;border-top:1px solid var(--theme-border-subtle);display:flex;flex-direction:column;gap:var(--ui-space-3)}
${R} .ui-row--flat{display:flex;align-items:flex-start;gap:6px;padding:8px}
${R} .ui-row-lead{display:flex;align-items:center;gap:2px;flex-shrink:0}
${R} .ui-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--ui-space-2)}
${R} .ui-grip{cursor:grab}
${R} .ui-grip:active{cursor:grabbing}
${R} .ui-row-move{display:none;align-items:center;gap:2px}
@media (pointer:coarse){${R} .ui-row-move{display:inline-flex}${R} .ui-grip{display:none}}
@media (prefers-reduced-motion:reduce){${R} .ui-row-chev{transition:none}}

/* editor card (field editors) */
.ui-root.ui-ecard{border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);background:var(--theme-surface);width:100%}
${R} .ui-ecard-h{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--ui-space-3);padding:12px 14px;background:var(--theme-surface-subtle);border-bottom:1px solid var(--theme-border);box-shadow:inset 3px 0 0 var(--theme-primary);border-top-left-radius:var(--ui-radius-sm);border-top-right-radius:var(--ui-radius-sm)}
${R} .ui-ecard-titles{min-width:0;display:flex;flex-direction:column;gap:2px}
${R} .ui-ecard-title{margin:0;font-size:var(--ui-fs-body);font-weight:700;line-height:1.35;color:var(--theme-text)}
${R} .ui-ecard-desc{margin:0;font-size:var(--ui-fs-caption);line-height:var(--ui-lh-caption);color:var(--theme-text-muted)}
${R} .ui-ecard-action{flex-shrink:0;display:flex;align-items:center;gap:var(--ui-space-2)}
${R} .ui-ecard-b{padding:14px;display:flex;flex-direction:column;gap:var(--ui-space-3)}
${R} .ui-ecard-b--flush{padding:0}
${R} .ui-linkout{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-3);flex-wrap:wrap}
${R} .ui-linkout-text{margin:0;flex:1;min-width:200px;font-size:var(--ui-fs-body-sm);color:var(--theme-text-secondary)}

/* object field card */
${R} .ui-ofc{display:flex;flex-direction:column;gap:var(--ui-space-4)}
${R} .ui-ofc-sec + .ui-ofc-sec{border-top:1px solid var(--theme-border-subtle);padding-top:var(--ui-space-4)}
${R} .ui-ofc-sec-title{margin:0 0 10px;font-size:var(--ui-fs-section-title);font-weight:var(--ui-fw-section-title);letter-spacing:var(--ui-ls-section-title);text-transform:uppercase;color:var(--theme-text-secondary)}
${R} .ui-ofc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--ui-space-3) var(--ui-space-4)}
${R} .ui-ofc-span2{grid-column:1 / -1}
@media (max-width:720px){${R} .ui-ofc-grid{grid-template-columns:minmax(0,1fr)}}

/* help tip */
.ui-root.ui-tipbtn{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;padding:0;margin:0;border:none;background:none;color:var(--theme-text-muted);cursor:help;vertical-align:middle;line-height:0;border-radius:var(--ui-radius-sm)}
.ui-root.ui-tipbtn:hover,.ui-root.ui-tipbtn[aria-expanded="true"]{color:var(--theme-primary)}
.ui-root.ui-tipbtn:focus-visible{outline:2px solid var(--theme-focus);outline-offset:1px}

/* floating layer (Popover): lists, time spinners, tooltips */
.ui-root.ui-pop{position:fixed;z-index:99990;background:var(--theme-surface);color:var(--theme-text);border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);box-shadow:var(--theme-shadow-md)}
.ui-root.ui-pop.ui-tip{max-width:280px;min-width:160px;padding:8px 12px;background:var(--theme-text);color:var(--theme-surface);border-color:var(--theme-text);font-size:12px;font-weight:500;line-height:1.45}
.ui-root.ui-pop.ui-list{max-height:280px;overflow-y:auto;padding:4px;display:flex;flex-direction:column;gap:1px}
${R} .ui-opt{display:flex;flex-direction:column;gap:1px;padding:7px 9px;border-radius:var(--ui-radius-sm);font-size:var(--ui-fs-body);color:var(--theme-text);cursor:pointer;user-select:none}
${R} .ui-opt[data-active="true"]{background:var(--theme-primary-soft);color:var(--theme-primary)}
${R} .ui-opt[aria-selected="true"]{font-weight:700}
${R} .ui-opt[aria-disabled="true"]{color:var(--theme-text-disabled);cursor:default}
${R} .ui-opt-hint{font-size:var(--ui-fs-caption);font-weight:400;color:var(--theme-text-muted)}
${R} .ui-opt--create{flex-direction:row;align-items:center;gap:6px;color:var(--theme-primary);font-weight:600;border-top:1px solid var(--theme-border-subtle)}
${R} .ui-list-note{padding:8px 9px;font-size:var(--ui-fs-body-sm);color:var(--theme-text-muted)}

/* number input (stepper) */
.ui-root.ui-numin{position:relative;display:inline-flex;width:100%;vertical-align:top}
${R} .ui-numin .ui-input{padding-right:30px;font-variant-numeric:tabular-nums}
${R} .ui-numin-steps{position:absolute;top:1px;right:1px;bottom:1px;width:22px;display:flex;flex-direction:column;border-left:1px solid var(--theme-border);border-top-right-radius:var(--ui-radius-sm);border-bottom-right-radius:var(--ui-radius-sm);overflow:hidden}
${R} .ui-numin-steps button{flex:1;display:flex;align-items:center;justify-content:center;padding:0;border:none;background:var(--theme-surface-subtle);color:var(--theme-text-muted);cursor:pointer}
${R} .ui-numin-steps button + button{border-top:1px solid var(--theme-border)}
${R} .ui-numin-steps button:hover:not(:disabled){background:var(--theme-primary-soft);color:var(--theme-primary)}
${R} .ui-numin-steps button:disabled{opacity:.4;cursor:default}
.ui-root.ui-numin--lg{width:72px}
${R} .ui-numin--lg .ui-input{height:46px;padding:0 26px 0 6px;text-align:center;font-size:20px;font-weight:700}
${R} .ui-numin--lg .ui-numin-steps{width:22px}

/* time input */
.ui-root.ui-time{position:relative;display:inline-flex;width:100%;vertical-align:top}
${R} .ui-time .ui-input{padding-left:32px;letter-spacing:.04em;font-variant-numeric:tabular-nums}
${R} .ui-time-btn{position:absolute;left:4px;top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:none;background:none;border-radius:var(--ui-radius-sm);color:var(--theme-text-muted);cursor:pointer}
${R} .ui-time-btn:hover:not(:disabled),${R} .ui-time-btn[aria-expanded="true"]{color:var(--theme-primary);background:var(--theme-primary-soft)}
${R} .ui-time-btn:disabled{cursor:not-allowed;opacity:.55}
.ui-root.ui-pop.ui-time-pop{padding:14px 16px}
${R} .ui-time-spin{display:flex;align-items:center;justify-content:center;gap:8px}
${R} .ui-time-colon{font-size:20px;font-weight:700;color:var(--theme-text-muted);user-select:none}
${R} .ui-time-note{margin-top:10px;text-align:center}

/* date range */
.ui-root.ui-range{display:flex;flex-direction:column;gap:6px}

/* tags input */
.ui-root.ui-tags{display:flex;flex-wrap:wrap;align-items:center;gap:6px;width:100%;min-height:35px;padding:4px 6px;background:var(--theme-surface-sunken);border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);cursor:text;transition:border-color var(--ui-motion-fast) var(--ui-easing)}
.ui-root.ui-tags:focus-within{border-color:var(--theme-primary);box-shadow:0 0 0 1px var(--theme-primary)}
.ui-root.ui-tags--disabled{cursor:not-allowed;opacity:.7}
${R} .ui-tags-in{flex:1;min-width:120px;padding:3px 3px;border:none;background:transparent;font-family:inherit;font-size:var(--ui-fs-body);color:var(--theme-text);outline:none}
${R} .ui-tags-in::placeholder{color:var(--theme-text-muted);opacity:1}
${R} .ui-tags-in:focus-visible{outline:none}

/* searchable select (combobox) */
.ui-root.ui-cbx{position:relative;display:block;width:100%}
${R} .ui-cbx .ui-input{padding-right:60px}
${R} .ui-cbx-actions{position:absolute;top:0;right:5px;bottom:0;display:flex;align-items:center;gap:2px;color:var(--theme-text-muted)}

/* segmented control */
.ui-root.ui-seg{display:inline-flex;align-items:stretch;gap:2px;padding:2px;background:var(--theme-surface-sunken);border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);max-width:100%}
.ui-root.ui-seg--block{display:flex;width:100%}
${R} .ui-seg-opt{flex:0 1 auto;min-width:0;padding:6px 14px;border:none;border-radius:var(--ui-radius-sm);background:transparent;font-family:inherit;font-size:var(--ui-fs-body-sm);font-weight:600;line-height:1.2;color:var(--theme-text-secondary);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background-color var(--ui-motion-fast) var(--ui-easing),color var(--ui-motion-fast) var(--ui-easing)}
${R} .ui-seg--block .ui-seg-opt{flex:1 1 0}
${R} .ui-seg--sm .ui-seg-opt{padding:4px 10px;font-size:12px}
${R} .ui-seg-opt:hover:not(:disabled):not([aria-checked="true"]){background:var(--theme-surface);color:var(--theme-text)}
${R} .ui-seg-opt[aria-checked="true"]{background:var(--theme-primary);color:var(--theme-on-primary)}
${R} .ui-seg-opt:disabled{opacity:.5;cursor:default}

/* gallery grid */
.ui-root.ui-gal-wrap{display:block}
${R} .ui-gal{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(var(--ui-gal-cols,4),minmax(0,1fr));gap:10px}
@media (max-width:640px){${R} .ui-gal{grid-template-columns:repeat(2,minmax(0,1fr))}}
${R} .ui-gal-tile{position:relative;aspect-ratio:1 / 1;border:1px solid var(--theme-border-strong);border-radius:var(--ui-radius-sm);background:var(--theme-surface-sunken) center / cover no-repeat;transition:opacity var(--ui-motion-fast) var(--ui-easing)}
${R} .ui-gal-tile[data-dragging="true"]{opacity:.45}
${R} .ui-gal-hit{position:absolute;inset:0;width:100%;height:100%;padding:0;border:none;background:none;cursor:pointer;border-radius:var(--ui-radius-sm)}
${R} .ui-gal-hit:hover{box-shadow:inset 0 0 0 2px var(--theme-primary)}
${R} .ui-gal-x,${R} .ui-gal-grip{position:absolute;top:6px;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);background:var(--theme-surface);color:var(--theme-text-secondary);cursor:pointer;box-shadow:var(--theme-shadow-sm)}
${R} .ui-gal-x{right:6px}
${R} .ui-gal-grip{left:6px;cursor:grab}
${R} .ui-gal-x:hover:not(:disabled){background:var(--theme-danger-bg);border-color:var(--theme-danger-border);color:var(--theme-danger)}
${R} .ui-gal-grip:hover:not(:disabled){color:var(--theme-primary)}
${R} .ui-gal-cap{position:absolute;left:6px;bottom:6px;max-width:calc(100% - 12px);padding:1px 6px;font-size:10.5px;font-weight:700;line-height:1.5;color:var(--theme-text-secondary);background:var(--theme-surface);border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none}
${R} .ui-gal-tile--empty{background:var(--theme-surface-subtle);border-color:var(--theme-border)}
${R} .ui-gal-add{position:absolute;inset:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:8px;border:none;background:none;border-radius:var(--ui-radius-sm);font-family:inherit;font-size:var(--ui-fs-body-sm);font-weight:600;color:var(--theme-text-muted);cursor:pointer;text-align:center}
${R} .ui-gal-add:hover:not(:disabled){color:var(--theme-primary);background:var(--theme-primary-soft)}
${R} .ui-gal-tile--empty:hover{border-color:var(--theme-primary)}
${R} .ui-gal-add:disabled{cursor:default;opacity:.55}
${R} .ui-gal-tile--empty .ui-gal-cap{background:none;border-color:transparent;color:var(--theme-text-muted)}

/* image picker: video and file previews */
${R} .ui-img-pv video{display:block;width:100%;height:100%;object-fit:cover;border-radius:var(--ui-radius-sm)}
${R} .ui-img-file{display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;letter-spacing:.05em;color:var(--theme-text-muted)}

/* reference page */
${R} .ui-ref-row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-2)}
${R} .ui-ref-swatch{display:flex;flex-direction:column;gap:4px;width:132px;font-size:var(--ui-fs-caption);color:var(--theme-text-muted)}
${R} .ui-ref-swatch i{display:block;height:36px;border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm)}
${R} .ui-ref-code{font-family:var(--ui-font-mono);font-size:11px;color:var(--theme-text-secondary)}
${R} .ui-ref-code.ui-muted{color:var(--theme-text-muted)}
${R} .ui-ref-swatch--sm{width:76px}
${R} .ui-ref-swatch--sm i{height:28px}
${R} .ui-ref-swatch .ui-ref-code{overflow-wrap:anywhere}
${R} .ui-ref-theme{display:flex;flex-direction:column;gap:var(--ui-space-2);padding:var(--ui-space-3);background:var(--theme-bg);color:var(--theme-text);border:1px solid var(--theme-border);border-radius:var(--ui-radius-sm)}

/* toast: general, short-lived feedback (see Toast.tsx). Notice stays for
   persistent, page-bound messages. */
.ui-root.ui-toast-viewport{position:fixed;top:calc(56px + var(--ui-space-4));right:var(--ui-space-4);z-index:500;display:flex;flex-direction:column;gap:var(--ui-space-2);width:360px;max-width:calc(100vw - 32px);pointer-events:none}
${R} .ui-toast{pointer-events:auto;display:flex;align-items:flex-start;gap:var(--ui-space-3);background:var(--theme-surface);border:1px solid var(--theme-border);border-left:3px solid var(--ui-toast-fg,var(--theme-border));border-radius:var(--ui-radius-sm);box-shadow:var(--theme-shadow-md);padding:10px 12px;font-size:var(--ui-fs-body);color:var(--theme-text);animation:ui-toast-in var(--ui-motion-fast) var(--ui-easing) both}
${R} .ui-toast-text{flex:1;line-height:1.45;min-width:0}
${R} .ui-toast-title{display:block;font-weight:700;margin-bottom:1px}
${R} .ui-toast-body{color:var(--theme-text-secondary)}
${R} .ui-toast-close{flex-shrink:0;align-self:flex-start}
${R} .ui-toast--success{--ui-toast-fg:var(--theme-success)}
${R} .ui-toast--info{--ui-toast-fg:var(--theme-info)}
${R} .ui-toast--warning{--ui-toast-fg:var(--theme-warning)}
${R} .ui-toast--danger{--ui-toast-fg:var(--theme-danger)}
@keyframes ui-toast-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
${R} .ui-toast--out{opacity:0;transform:translateY(-6px);transition:opacity var(--ui-motion-fast) var(--ui-easing),transform var(--ui-motion-fast) var(--ui-easing)}
@media (prefers-reduced-motion:reduce){${R} .ui-toast{animation:none}${R} .ui-toast--out{transition:none}}
@media (max-width:640px){.ui-root.ui-toast-viewport{top:var(--ui-space-3);left:var(--ui-space-3);right:var(--ui-space-3);width:auto;max-width:none}}
`;

const STYLE_ID = 'ui-styles';

/**
 * Inject the token blocks + component classes once and start mirroring the
 * Strapi theme on <html data-theme>. Idempotent: the admin bootstrap
 * calls it, and AdminPage / Modal call it again as a safety net.
 */
export function ensureAdminUi(): void {
  if (typeof document === 'undefined') return;
  startAdminThemeSync();
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = tokensCss() + '\n' + UI_CSS;
  document.head.appendChild(style);
}
