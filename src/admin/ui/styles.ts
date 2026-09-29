import { tokensCss } from './tokens';
import { startAdminThemeSync } from './useAdminTheme';

/**
 * Stylesheet for the shared admin components (src/admin/ui).
 *
 * Rules:
 *   - every value comes from a var(--adm-*) custom property generated from
 *     ./tokens.ts; no raw colours here (scripts/admin-ui-check.mjs enforces it);
 *   - every class is prefixed `adm-` and scoped under `.adm-root`, so it never
 *     collides with the legacy `.eduf`, `.insp` or page-local classes, and it
 *     wins over `.eduf input` style element selectors while pages migrate;
 *   - square corners only (radius sm / md), no dashed borders.
 *
 * `.adm-root` is set by AdminPage and by the Modal portal. It also opts every
 * button inside out of the global SaveBar tagger in app.tsx.
 *
 * Kept free of backticks inside the CSS on purpose: one stray backtick in a
 * template literal takes the whole admin panel down to a blank page.
 */

const R = '.adm-root';

export const ADM_CSS = `
${R}{font-family:var(--adm-font);font-size:var(--adm-fs-body);line-height:var(--adm-lh-body);color:var(--adm-text-primary);color-scheme:var(--adm-color-scheme)}
${R} *,${R} *::before,${R} *::after{box-sizing:border-box}
${R} :focus-visible{outline:2px solid var(--adm-focus);outline-offset:1px}
${R} a{color:var(--adm-accent);text-decoration:none}
${R} a:hover{text-decoration:underline}
${R} .adm-num{font-variant-numeric:tabular-nums}
${R} .adm-muted{color:var(--adm-text-muted)}
${R} .adm-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

/* page root. flex-shrink:0: Strapi renders plugin pages inside a fixed-height
   flex column; without it the background stops after the first screen. */
.adm-root.adm-page{background:var(--adm-surface-page);min-height:100%;flex-shrink:0;padding:var(--adm-space-5)}
@media (max-width:640px){.adm-root.adm-page{padding:var(--adm-space-3)}}
${R} .adm-stack{display:flex;flex-direction:column;gap:var(--adm-space-4)}

/* window */
${R} .adm-win{background:var(--adm-surface-raised);border:1px solid var(--adm-line);border-radius:var(--adm-radius-md);box-shadow:var(--adm-shadow-sm);overflow:clip}

/* page header */
${R} .adm-ph{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--adm-space-4);padding:var(--adm-space-4) 18px;border-bottom:1px solid var(--adm-line)}
${R} .adm-ph-back{display:inline-flex;align-items:center;gap:var(--adm-space-1);font-size:var(--adm-fs-caption);font-weight:600;color:var(--adm-text-muted);margin-bottom:var(--adm-space-1);background:none;border:none;padding:0;cursor:pointer;font-family:inherit}
${R} .adm-ph-back:hover{color:var(--adm-accent);text-decoration:none}
${R} .adm-ph-title{margin:0;font-size:var(--adm-fs-page-title);font-weight:var(--adm-fw-page-title);line-height:var(--adm-lh-page-title);letter-spacing:var(--adm-ls-page-title);color:var(--adm-text-primary)}
${R} .adm-ph-sub{margin:3px 0 0;font-size:var(--adm-fs-body-sm);color:var(--adm-text-muted)}
${R} .adm-ph-actions{display:flex;align-items:center;gap:var(--adm-space-2);flex-shrink:0;flex-wrap:wrap;justify-content:flex-end}
@media (max-width:640px){${R} .adm-ph{flex-direction:column}${R} .adm-ph-actions{justify-content:flex-start}}

/* buttons */
${R} .adm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;font-size:var(--adm-fs-body-sm);font-weight:600;line-height:1.2;padding:7px 12px;border-radius:var(--adm-radius-sm);border:1px solid var(--adm-line-strong);background:var(--adm-surface-raised);color:var(--adm-text-primary);cursor:pointer;white-space:nowrap;transition:background-color var(--adm-motion-fast) var(--adm-easing),border-color var(--adm-motion-fast) var(--adm-easing),color var(--adm-motion-fast) var(--adm-easing)}
${R} .adm-btn:hover:not(:disabled){background:var(--adm-surface-subtle);border-color:var(--adm-text-muted)}
${R} .adm-btn--primary{background:var(--adm-accent);border-color:var(--adm-accent);color:var(--adm-text-on-accent)}
${R} .adm-btn--primary:hover:not(:disabled){background:var(--adm-accent-hover);border-color:var(--adm-accent-hover)}
${R} .adm-btn--danger{color:var(--adm-danger-fg);border-color:var(--adm-danger-line);background:var(--adm-surface-raised)}
${R} .adm-btn--danger:hover:not(:disabled){background:var(--adm-danger-bg);border-color:var(--adm-danger-fg)}
${R} .adm-btn--danger.adm-btn--solid{background:var(--adm-danger-fg);border-color:var(--adm-danger-fg);color:var(--adm-surface-raised)}
${R} .adm-btn--danger.adm-btn--solid:hover:not(:disabled){background:var(--adm-danger-fg);border-color:var(--adm-danger-fg);filter:brightness(.92)}
${R} .adm-btn--ghost{background:transparent;border-color:transparent;color:var(--adm-text-secondary)}
${R} .adm-btn--ghost:hover:not(:disabled){background:var(--adm-accent-soft);border-color:transparent;color:var(--adm-accent)}
${R} .adm-btn--sm{padding:5px 9px;font-size:12px}
${R} .adm-btn--icon{padding:7px}
${R} .adm-btn--icon.adm-btn--sm{padding:5px}
${R} .adm-btn:disabled{opacity:.55;cursor:default}
${R} .adm-btn[aria-busy="true"]{cursor:progress}
${R} .adm-btn svg{width:14px;height:14px;flex-shrink:0}

/* status badge */
${R} .adm-badge{display:inline-flex;align-items:center;gap:4px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border:1px solid var(--adm-badge-line);color:var(--adm-badge-fg);background:var(--adm-badge-bg);border-radius:var(--adm-radius-sm);white-space:nowrap;line-height:1.3}
${R} .adm-badge--sm{font-size:10px;padding:1px 5px}
${R} .adm-badge--md{font-size:11px;padding:3px 7px}
${R} .adm-badge--ok{--adm-badge-fg:var(--adm-ok-fg);--adm-badge-bg:var(--adm-ok-bg);--adm-badge-line:var(--adm-ok-line)}
${R} .adm-badge--warn{--adm-badge-fg:var(--adm-warn-fg);--adm-badge-bg:var(--adm-warn-bg);--adm-badge-line:var(--adm-warn-line)}
${R} .adm-badge--danger{--adm-badge-fg:var(--adm-danger-fg);--adm-badge-bg:var(--adm-danger-bg);--adm-badge-line:var(--adm-danger-line)}
${R} .adm-badge--info{--adm-badge-fg:var(--adm-info-fg);--adm-badge-bg:var(--adm-info-bg);--adm-badge-line:var(--adm-info-line)}
${R} .adm-badge--neutral{--adm-badge-fg:var(--adm-neutral-fg);--adm-badge-bg:var(--adm-neutral-bg);--adm-badge-line:var(--adm-neutral-line)}
${R} .adm-badge--accent{--adm-badge-fg:var(--adm-accent);--adm-badge-bg:var(--adm-accent-soft);--adm-badge-line:var(--adm-accent-soft-line)}

/* chip */
${R} .adm-chip{display:inline-flex;align-items:center;gap:6px;background:var(--adm-accent-soft);color:var(--adm-accent);border:1px solid var(--adm-accent-soft-line);border-radius:var(--adm-radius-sm);padding:3px 4px 3px 8px;font-size:12px;font-weight:600;line-height:1.35;max-width:100%}
${R} .adm-chip-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${R} .adm-chip-x{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border:none;background:none;color:inherit;cursor:pointer;padding:0;border-radius:var(--adm-radius-sm);opacity:.75;font-family:inherit;font-size:13px;line-height:1}
${R} .adm-chip-x:hover{opacity:1;background:var(--adm-accent-soft-line)}
${R} .adm-chip--static{padding-right:8px}
${R} .adm-chips{display:flex;flex-wrap:wrap;gap:6px}

/* switch */
${R} .adm-switch{display:inline-flex;align-items:center;gap:9px;background:none;border:none;padding:2px 0;font-family:inherit;font-size:var(--adm-fs-body);color:var(--adm-text-primary);cursor:pointer;text-align:left}
${R} .adm-switch-track{position:relative;flex-shrink:0;width:32px;height:18px;border:1px solid var(--adm-line-strong);border-radius:var(--adm-radius-sm);background:var(--adm-surface-sunken);transition:background-color var(--adm-motion-fast) var(--adm-easing),border-color var(--adm-motion-fast) var(--adm-easing)}
${R} .adm-switch-thumb{position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:var(--adm-radius-sm);background:var(--adm-text-muted);transition:transform var(--adm-motion-fast) var(--adm-easing),background-color var(--adm-motion-fast) var(--adm-easing)}
${R} .adm-switch[aria-checked="true"] .adm-switch-track{background:var(--adm-accent);border-color:var(--adm-accent)}
${R} .adm-switch[aria-checked="true"] .adm-switch-thumb{transform:translateX(14px);background:var(--adm-text-on-accent)}
${R} .adm-switch:disabled{opacity:.55;cursor:default}
${R} .adm-switch-text{display:flex;flex-direction:column}
${R} .adm-switch-desc{font-size:var(--adm-fs-caption);color:var(--adm-text-muted)}

/* checkbox */
${R} .adm-check{display:inline-flex;align-items:flex-start;gap:8px;font-size:var(--adm-fs-body);cursor:pointer;user-select:none;color:var(--adm-text-primary)}
${R} .adm-check input{appearance:none;-webkit-appearance:none;margin:2px 0 0;flex-shrink:0;width:16px;height:16px;border:1px solid var(--adm-line-strong);border-radius:var(--adm-radius-sm);background:var(--adm-surface-raised);display:inline-grid;place-content:center;cursor:pointer;transition:background-color var(--adm-motion-fast) var(--adm-easing)}
${R} .adm-check input::before{content:"";width:9px;height:5px;border-left:2px solid var(--adm-text-on-accent);border-bottom:2px solid var(--adm-text-on-accent);transform:translateY(-1px) rotate(-45deg);opacity:0}
${R} .adm-check input:checked{background:var(--adm-accent);border-color:var(--adm-accent)}
${R} .adm-check input:checked::before{opacity:1}
${R} .adm-check input:indeterminate{background:var(--adm-accent);border-color:var(--adm-accent)}
${R} .adm-check input:indeterminate::before{opacity:1;border-left:none;transform:none;height:0;width:8px}
${R} .adm-check input:disabled{opacity:.55;cursor:default}
${R} .adm-check--disabled{cursor:default;color:var(--adm-text-disabled)}

/* fields */
${R} .adm-field{display:flex;flex-direction:column;gap:4px;min-width:0}
${R} .adm-label{font-size:var(--adm-fs-label);font-weight:var(--adm-fw-label);letter-spacing:var(--adm-ls-label);text-transform:uppercase;color:var(--adm-text-muted)}
${R} .adm-req{color:var(--adm-danger-fg);margin-left:3px}
${R} .adm-hint{font-size:var(--adm-fs-caption);color:var(--adm-text-muted);line-height:var(--adm-lh-caption)}
${R} .adm-error{font-size:var(--adm-fs-caption);color:var(--adm-danger-fg);font-weight:600;line-height:var(--adm-lh-caption)}
${R} .adm-input{width:100%;font-family:inherit;font-size:var(--adm-fs-body);line-height:1.4;color:var(--adm-text-primary);background:var(--adm-surface-sunken);border:1px solid var(--adm-line-strong);border-radius:var(--adm-radius-sm);padding:7px 9px;transition:border-color var(--adm-motion-fast) var(--adm-easing)}
${R} .adm-input::placeholder{color:var(--adm-text-muted);opacity:1}
${R} .adm-input:focus{outline:none;border-color:var(--adm-accent);box-shadow:0 0 0 1px var(--adm-accent)}
${R} .adm-input:disabled{color:var(--adm-text-disabled);cursor:not-allowed}
${R} .adm-input[aria-invalid="true"]{border-color:var(--adm-danger-fg)}
${R} textarea.adm-input{resize:vertical;min-height:64px}
${R} select.adm-input{padding-right:6px}
${R} .adm-grid2{display:grid;grid-template-columns:1fr 1fr;gap:var(--adm-space-3)}
@media (max-width:640px){${R} .adm-grid2{grid-template-columns:1fr}}

/* section */
${R} .adm-sec{border:1px solid var(--adm-line);border-radius:var(--adm-radius-md);background:var(--adm-surface-raised)}
${R} .adm-sec-h{display:flex;align-items:center;justify-content:space-between;gap:var(--adm-space-2);padding:10px 13px;border-bottom:1px solid var(--adm-line)}
${R} .adm-sec-title{margin:0;font-size:var(--adm-fs-section-title);font-weight:var(--adm-fw-section-title);letter-spacing:var(--adm-ls-section-title);text-transform:uppercase;color:var(--adm-text-muted)}
${R} .adm-sec-b{padding:13px;display:flex;flex-direction:column;gap:var(--adm-space-3)}
${R} .adm-sec-f{display:flex;align-items:center;gap:var(--adm-space-2);padding:10px 13px;border-top:1px solid var(--adm-line);background:var(--adm-surface-subtle)}

/* two column: rail + body */
${R} .adm-two{display:grid;grid-template-columns:var(--adm-rail-w,280px) minmax(0,1fr);align-items:start}
${R} .adm-rail{border-right:1px solid var(--adm-line);padding:var(--adm-space-4) 18px;background:var(--adm-surface-subtle);align-self:stretch}
${R} .adm-body{padding:var(--adm-space-4) 18px;display:flex;flex-direction:column;gap:14px;min-width:0}
@media (max-width:900px){${R} .adm-two{grid-template-columns:1fr}${R} .adm-rail{border-right:none;border-bottom:1px solid var(--adm-line)}}

/* save bar */
${R} .adm-savebar{position:sticky;bottom:0;z-index:20;display:flex;align-items:center;gap:var(--adm-space-3);padding:11px 18px;border-top:1px solid var(--adm-line);background:var(--adm-surface-subtle)}
${R} .adm-savebar-status{flex:1;display:flex;align-items:center;gap:8px;font-size:var(--adm-fs-body-sm);color:var(--adm-text-muted);min-width:0}
${R} .adm-savebar-status[data-state="dirty"]{color:var(--adm-warn-fg);font-weight:600}
${R} .adm-savebar-status[data-state="saved"]{color:var(--adm-ok-fg);font-weight:600}
${R} .adm-savebar-status[data-state="error"]{color:var(--adm-danger-fg);font-weight:600}
${R} .adm-savebar-dot{width:8px;height:8px;flex-shrink:0;background:currentColor;border-radius:var(--adm-radius-none)}
${R} .adm-savebar-keys{font-size:var(--adm-fs-caption);color:var(--adm-text-muted)}
@media (max-width:640px){${R} .adm-savebar-keys{display:none}}

/* notice */
${R} .adm-notice{display:flex;align-items:flex-start;gap:var(--adm-space-3);font-size:var(--adm-fs-body-sm);color:var(--adm-text-primary);background:var(--adm-notice-bg);border:1px solid var(--adm-notice-line);border-radius:var(--adm-radius-sm);padding:10px 12px}
${R} .adm-notice-mark{width:3px;align-self:stretch;flex-shrink:0;background:var(--adm-notice-fg)}
${R} .adm-notice-text{flex:1;line-height:1.45;min-width:0}
${R} .adm-notice-title{display:block;font-weight:700;color:var(--adm-notice-fg);margin-bottom:1px}
${R} .adm-notice-body{color:var(--adm-text-secondary)}
${R} .adm-notice-action{flex-shrink:0;align-self:center}
${R} .adm-notice--ok{--adm-notice-fg:var(--adm-ok-fg);--adm-notice-bg:var(--adm-ok-bg);--adm-notice-line:var(--adm-ok-line)}
${R} .adm-notice--warn{--adm-notice-fg:var(--adm-warn-fg);--adm-notice-bg:var(--adm-warn-bg);--adm-notice-line:var(--adm-warn-line)}
${R} .adm-notice--danger{--adm-notice-fg:var(--adm-danger-fg);--adm-notice-bg:var(--adm-danger-bg);--adm-notice-line:var(--adm-danger-line)}
${R} .adm-notice--info{--adm-notice-fg:var(--adm-info-fg);--adm-notice-bg:var(--adm-info-bg);--adm-notice-line:var(--adm-info-line)}

/* empty state + spinner */
${R} .adm-empty{display:flex;flex-direction:column;align-items:center;gap:var(--adm-space-3);padding:44px var(--adm-space-4);text-align:center;color:var(--adm-text-muted);font-size:var(--adm-fs-body)}
${R} .adm-empty-icon{color:var(--adm-text-disabled)}
${R} .adm-empty-icon svg{width:28px;height:28px}
${R} .adm-spinner{display:inline-block;flex-shrink:0;color:var(--adm-accent);animation:adm-spin .8s linear infinite}
${R} .adm-btn .adm-spinner{color:currentColor}
@keyframes adm-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){${R} .adm-spinner{animation-duration:2.4s}}
${R} .adm-loading{display:flex;align-items:center;justify-content:center;gap:8px;padding:44px var(--adm-space-4);color:var(--adm-text-muted);font-size:var(--adm-fs-body)}

/* modal (portal root carries .adm-root) */
.adm-root.adm-modal-layer{position:fixed;inset:0;z-index:var(--adm-modal-z,400);display:flex;align-items:center;justify-content:center;padding:var(--adm-space-4);background:var(--adm-surface-overlay)}
${R} .adm-modal{width:var(--adm-modal-w,460px);max-width:100%;max-height:86vh;display:flex;flex-direction:column;background:var(--adm-surface-raised);border:1px solid var(--adm-line);border-radius:var(--adm-radius-md);box-shadow:var(--adm-shadow-md);overflow:hidden;color:var(--adm-text-primary)}
${R} .adm-modal:focus{outline:none}
${R} .adm-modal--md{--adm-modal-w:600px}
${R} .adm-modal--lg{--adm-modal-w:720px}
${R} .adm-modal-h{display:flex;align-items:center;gap:10px;padding:13px 15px;border-bottom:1px solid var(--adm-line)}
${R} .adm-modal-title{margin:0;font-size:14px;font-weight:700;flex-shrink:0}
${R} .adm-modal-extra{flex:1;display:flex;align-items:center;gap:8px;justify-content:flex-end;min-width:0}
${R} .adm-modal-b{padding:14px 15px;overflow-y:auto;font-size:var(--adm-fs-body-sm);color:var(--adm-text-secondary);line-height:1.5}
${R} .adm-modal-f{display:flex;gap:10px;justify-content:flex-end;padding:12px 15px;border-top:1px solid var(--adm-line);background:var(--adm-surface-subtle)}

/* tabs */
${R} .adm-tabs{display:flex;gap:2px;border-bottom:1px solid var(--adm-line);overflow-x:auto}
${R} .adm-tab{display:inline-flex;align-items:center;gap:6px;font-family:inherit;font-size:var(--adm-fs-body-sm);font-weight:600;color:var(--adm-text-muted);background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-1px;padding:9px 12px;cursor:pointer;white-space:nowrap}
${R} .adm-tab:hover{color:var(--adm-text-primary)}
${R} .adm-tab[aria-selected="true"]{color:var(--adm-accent);border-bottom-color:var(--adm-accent)}
${R} .adm-tab-count{font-size:10.5px;font-weight:700;color:var(--adm-text-muted);background:var(--adm-neutral-bg);border-radius:var(--adm-radius-sm);padding:0 5px}
${R} .adm-tab[aria-selected="true"] .adm-tab-count{color:var(--adm-accent);background:var(--adm-accent-soft)}

/* pager */
${R} .adm-pager{display:flex;align-items:center;gap:var(--adm-space-3);flex-wrap:wrap;font-size:12px;color:var(--adm-text-muted)}
${R} .adm-pager-range{flex:1}
${R} .adm-pager-pages{display:flex;align-items:center;gap:4px;margin-left:auto}
${R} .adm-pg{min-width:28px;height:28px;padding:0 7px;font-family:inherit;font-size:12px;font-weight:600;color:var(--adm-text-secondary);background:var(--adm-surface-raised);border:1px solid var(--adm-line);border-radius:var(--adm-radius-sm);cursor:pointer}
${R} .adm-pg:hover:not(:disabled){border-color:var(--adm-line-strong)}
${R} .adm-pg[aria-current="page"]{background:var(--adm-accent);border-color:var(--adm-accent);color:var(--adm-text-on-accent)}
${R} .adm-pg:disabled{opacity:.45;cursor:default}
${R} .adm-pg-gap{min-width:16px;text-align:center}
${R} .adm-confirm-typed .adm-label{text-transform:none;letter-spacing:0;font-size:var(--adm-fs-body-sm);font-weight:600;color:var(--adm-text-primary)}

/* data table */
${R} .adm-dt-bar{display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid var(--adm-line);flex-wrap:wrap}
${R} .adm-dt-search{flex:1;min-width:200px;max-width:420px}
${R} .adm-dt-wrap{overflow-x:auto}
${R} .adm-dt{border-collapse:collapse;width:100%;font-size:var(--adm-fs-body)}
${R} .adm-dt th{text-align:left;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--adm-text-muted);font-weight:700;padding:10px 14px;border-bottom:1px solid var(--adm-line);white-space:nowrap}
${R} .adm-dt th button{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
${R} .adm-dt th button:hover{color:var(--adm-text-primary)}
${R} .adm-dt th button:focus-visible{outline:2px solid var(--adm-focus);outline-offset:1px}
${R} .adm-dt th[aria-sort="ascending"],${R} .adm-dt th[aria-sort="descending"]{color:var(--adm-accent)}
${R} .adm-dt td{padding:10px 14px;border-bottom:1px solid var(--adm-line-subtle);vertical-align:middle}
${R} .adm-dt tbody tr.adm-dt-click{cursor:pointer}
${R} .adm-dt tbody tr.adm-dt-click:hover td{background:var(--adm-surface-subtle)}
${R} .adm-dt-pager{padding:11px 18px;border-top:1px solid var(--adm-line)}
${R} .adm-dt-sort{font-size:9px;opacity:.8}

/* image picker */
${R} .adm-imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
${R} .adm-img{position:relative;padding:5px;border:1px solid var(--adm-line-strong);border-radius:var(--adm-radius-sm);background:var(--adm-surface-raised);cursor:pointer;font-family:inherit;text-align:left}
${R} .adm-img:hover{border-color:var(--adm-accent)}
${R} .adm-img[aria-pressed="true"]{border-color:var(--adm-accent);box-shadow:0 0 0 1px var(--adm-accent)}
${R} .adm-img-pv{width:100%;aspect-ratio:1/1;background:var(--adm-surface-sunken) center/cover no-repeat;border-radius:var(--adm-radius-sm)}
${R} .adm-img-name{font-size:11px;color:var(--adm-text-muted);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${R} .adm-img-tick{position:absolute;top:8px;right:8px;display:none;padding:1px 5px;font-size:10px;font-weight:700;background:var(--adm-accent);color:var(--adm-text-on-accent);border-radius:var(--adm-radius-sm)}
${R} .adm-img[aria-pressed="true"] .adm-img-tick{display:block}

/* inbox: list + reader */
${R} .adm-inbox{display:grid;grid-template-columns:var(--adm-inbox-list-w,360px) minmax(0,1fr);min-height:480px}
${R} .adm-inbox-list{border-right:1px solid var(--adm-line);display:flex;flex-direction:column;min-width:0}
${R} .adm-inbox-items{flex:1;overflow-y:auto}
${R} .adm-inbox-item{display:block;width:100%;text-align:left;font-family:inherit;font-size:var(--adm-fs-body-sm);color:var(--adm-text-primary);background:none;border:none;border-bottom:1px solid var(--adm-line-subtle);padding:10px 14px;cursor:pointer}
${R} .adm-inbox-item:hover{background:var(--adm-surface-subtle)}
${R} .adm-inbox-item[aria-current="true"]{background:var(--adm-accent-soft);box-shadow:inset 3px 0 0 var(--adm-accent)}
${R} .adm-inbox-reader{min-width:0;padding:var(--adm-space-4) 18px}
${R} .adm-inbox-back{display:none}
${R} .adm-inbox-group{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--adm-text-muted);padding:10px 14px 6px;background:var(--adm-surface-subtle);border-bottom:1px solid var(--adm-line-subtle)}
${R} .adm-inbox-pager{padding:10px 14px;border-top:1px solid var(--adm-line)}
${R} .adm-inbox-head{display:flex;flex-direction:column;gap:var(--adm-space-3);padding:var(--adm-space-3) 18px 0}
${R} .adm-inbox-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:var(--adm-space-3) 18px;border-bottom:1px solid var(--adm-line)}
@media (max-width:900px){${R} .adm-inbox{grid-template-columns:1fr}${R} .adm-inbox-list{border-right:none}${R} .adm-inbox[data-open="true"] .adm-inbox-list{display:none}${R} .adm-inbox[data-open="false"] .adm-inbox-reader{display:none}${R} .adm-inbox-back{display:inline-flex;margin-bottom:var(--adm-space-3)}}

/* reference page */
${R} .adm-ref-row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--adm-space-2)}
${R} .adm-ref-swatch{display:flex;flex-direction:column;gap:4px;width:132px;font-size:var(--adm-fs-caption);color:var(--adm-text-muted)}
${R} .adm-ref-swatch i{display:block;height:36px;border:1px solid var(--adm-line);border-radius:var(--adm-radius-sm)}
${R} .adm-ref-code{font-family:var(--adm-font-mono);font-size:11px;color:var(--adm-text-secondary)}
`;

const STYLE_ID = 'adm-ui-styles';

/**
 * Inject the token blocks + component classes once and start mirroring the
 * Strapi theme on <html data-adm-theme>. Idempotent: the admin bootstrap
 * calls it, and AdminPage / Modal call it again as a safety net.
 */
export function ensureAdminUi(): void {
  if (typeof document === 'undefined') return;
  startAdminThemeSync();
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = tokensCss() + '\n' + ADM_CSS;
  document.head.appendChild(style);
}
