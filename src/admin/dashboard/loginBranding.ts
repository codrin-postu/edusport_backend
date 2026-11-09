/**
 * The brand layer of the sign-in page: white ground, the navy "inside the L" shape, the EDUSPORT wordmark and the coloured ribbon
 * straddling the seam. The `/login` bundle (src/admin-login) draws it behind its form; Strapi's own login page is no longer
 * branded here (it is closed and redirected, 6b-1 spec 4.1).
 */
import climateFont from '../climate-crisis.ttf';
import { PALETTE as P } from '../ui/tokens';

export const BRAND_LAYER_ID = 'esd-auth';

/** The layer's markup; `label` is the line under the wordmark (the caller passes it from the copy file). */
export const brandInner = (label: string): string => `
  <svg class="esd-navy" viewBox="0 0 1000 600" preserveAspectRatio="none">
    <path d="M0,0 H525 V450 A95,95 0 0 1 430,545 H0 Z" fill="${P.brand.navy}"/>
  </svg>
  <div class="esd-brand">
    <p class="esd-eyebrow">Clubul Sportiv</p>
    <h1 class="esd-wordmark">EDUSPORT</h1>
    <p class="esd-label">${label}</p>
  </div>
  <svg class="esd-ribbon" viewBox="0 0 1000 600" preserveAspectRatio="none" fill="none">
    <g stroke-width="33">
      <path d="M-2000,590 H430 A140,140 0 0 0 570,450 V-2000" stroke="${P.auth.gold}"/>
      <path d="M-2000,560 H430 A110,110 0 0 0 540,450 V-2000" stroke="${P.brand.orange}"/>
      <path d="M-2000,530 H430 A80,80 0 0 0 510,450 V-2000" stroke="${P.brand.rust}"/>
      <path d="M-2000,500 H430 A50,50 0 0 0 480,450 V-2000" stroke="${P.brand.burgundy}"/>
    </g>
  </svg>
`;

const L = `#${BRAND_LAYER_ID}`;

/** The layer's rules: the wordmark font, the full-viewport layer, and its phone form (wordmark only, above the form). */
export const BRAND_CSS = `
@font-face {
  font-family: "EduSportWordmark";
  src: url(${climateFont}) format("truetype");
  font-weight: 400; font-display: block;
}
${L} {
  display: block; position: fixed; inset: 0; z-index: 0; overflow: hidden;
  background: ${P.grey[0]}; font-family: "Inter", system-ui, -apple-system, sans-serif;
}
${L} .esd-navy, ${L} .esd-ribbon { position: absolute; inset: 0; width: 100%; height: 100%; }
${L} .esd-brand { position: absolute; top: 56px; left: 56px; z-index: 2; display: flex; flex-direction: column; align-items: flex-start; }
${L} .esd-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .28em; text-transform: uppercase; color: ${P.auth.eyebrow}; margin: 0 0 12px; white-space: nowrap; }
${L} .esd-wordmark {
  font-family: "EduSportWordmark", "Inter", system-ui; font-weight: 400;
  font-variation-settings: "YEAR" 1979; font-size: clamp(34px, 4.4vw, 62px);
  line-height: .9; letter-spacing: 0; color: ${P.auth.wordmark}; margin: 0; white-space: nowrap;
}
${L} .esd-label { margin: 16px 0 0; font-size: 14px; font-weight: 600; letter-spacing: .02em; color: ${P.auth.label}; }
${L} .esd-brand, ${L} .esd-brand > * { border: 0 !important; box-shadow: none !important; }

@media (max-width: 960px) {
  ${L} .esd-navy, ${L} .esd-ribbon { display: none; }
  ${L} .esd-brand { top: 8vh; left: 0; right: 0; align-items: center; text-align: center; padding: 0 24px; }
  ${L} .esd-eyebrow { color: ${P.auth.eyebrowOnLight}; }
  ${L} .esd-wordmark { color: ${P.brand.navy}; font-size: clamp(28px, 9vw, 46px); }
  ${L} .esd-label { display: none; }
}
`;
