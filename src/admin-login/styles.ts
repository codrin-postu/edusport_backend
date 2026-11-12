import { BRAND_CSS } from '../admin/dashboard/loginBranding';
import { UI_CSS } from '../admin/ui/styles';
import { THEME_ATTR, tokensCss } from '../admin/ui/tokens';

/** The page's own layout: brand layer behind, the form column on the right (58 / 42), one column on phones. Colours are tokens only. */
const PAGE_CSS = `
html, body { margin: 0; background: var(--theme-surface); }
.ia-root { position: relative; min-height: 100vh; display: grid; grid-template-columns: 58% 1fr; font-family: "Inter", system-ui, -apple-system, sans-serif; color: var(--theme-text); }
.ia-form { grid-column: 2; position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; padding: clamp(32px, 6vh, 72px) clamp(20px, 3vw, 44px); box-sizing: border-box; }
.ia-card { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: var(--ui-space-4); }
.ia-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--theme-text); }
.ia-stack { display: flex; flex-direction: column; gap: var(--ui-space-4); }
.ia-list { display: flex; flex-direction: column; gap: var(--ui-space-2); }
.ia-text { margin: 0; font-size: var(--ui-fs-body); color: var(--theme-text-secondary); line-height: 1.45; }
.ia-or { margin: 0; text-align: center; font-size: var(--ui-fs-body-sm); color: var(--theme-text-muted); }
.ia-link { align-self: flex-start; font-size: var(--ui-fs-body-sm); font-weight: 600; color: var(--theme-primary); text-decoration: none; }
.ia-link:hover { text-decoration: underline; }
.ia-root .ia-problem .ui-notice-mark { display: none; }
.ia-root a.ia-google { width: 100%; box-sizing: border-box; text-decoration: none; padding: 9px 12px; }
.ia-root .ia-form .ui-btn[type="submit"] { width: 100%; padding: 9px 12px; }
.ia-pass { position: relative; }
.ia-pass .ui-input { padding-right: 40px; }
.ia-pass .ia-eye { position: absolute; top: 50%; right: 4px; transform: translateY(-50%); }
@media (max-width: 960px) {
  .ia-root { display: block; }
  .ia-form { padding: clamp(104px, 26vh, 210px) 18px 32px; }
}
`;

const STYLE_ID = 'edusport-intrare-style';

/** Injects the admin tokens, component classes, the brand layer and the page layout. The page is always light: it sits on the white brand panel. */
export function installStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  doc.documentElement.setAttribute(THEME_ATTR, 'light');
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = [tokensCss(), UI_CSS, BRAND_CSS, PAGE_CSS].join('\n');
  doc.head.appendChild(style);
}
