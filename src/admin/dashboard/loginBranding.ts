/**
 * Custom EduSport branding for the Strapi admin login page.
 *
 * Strapi has no official custom-auth-layout API, so this injects a full-viewport
 * brand layer (white ground + navy "inside the L" shape + EDUSPORT wordmark +
 * the colored ribbon straddling the seam) behind the page, and grids Strapi's
 * real login form into the right half. Only active on /admin/auth routes; fully
 * reversible (removed when navigating away).
 */
import climateFont from '../climate-crisis.ttf';

const STYLE_ID = 'edusport-auth-style';
const LAYER_ID = 'esd-auth';

const BRAND_INNER = `
  <svg class="esd-navy" viewBox="0 0 1000 600" preserveAspectRatio="none">
    <path d="M0,0 H525 V450 A95,95 0 0 1 430,545 H0 Z" fill="#0e1a3c"/>
  </svg>
  <div class="esd-brand">
    <p class="esd-eyebrow">Clubul Sportiv</p>
    <h1 class="esd-wordmark">EDUSPORT</h1>
    <p class="esd-label">Panou de administrare</p>
  </div>
  <svg class="esd-ribbon" viewBox="0 0 1000 600" preserveAspectRatio="none" fill="none">
    <g stroke-width="33">
      <path d="M-2000,590 H430 A140,140 0 0 0 570,450 V-2000" stroke="#efb22b"/>
      <path d="M-2000,560 H430 A110,110 0 0 0 540,450 V-2000" stroke="#ea7233"/>
      <path d="M-2000,530 H430 A80,80 0 0 0 510,450 V-2000" stroke="#be3330"/>
      <path d="M-2000,500 H430 A50,50 0 0 0 480,450 V-2000" stroke="#6e4256"/>
    </g>
  </svg>
`;

const AUTH_CSS = `
@font-face {
  font-family: "EduSportWordmark";
  src: url(${climateFont}) format("truetype");
  font-weight: 400; font-display: block;
}

/* Brand layer, only visible on auth routes. */
#${LAYER_ID} { display: none; }
html[data-esd-auth] #${LAYER_ID} {
  display: block; position: fixed; inset: 0; z-index: 0; overflow: hidden;
  background: #fff; font-family: "Inter", system-ui, -apple-system, sans-serif;
}
#${LAYER_ID} .esd-navy,
#${LAYER_ID} .esd-ribbon { position: absolute; inset: 0; width: 100%; height: 100%; }
#${LAYER_ID} .esd-brand { position: absolute; top: 56px; left: 56px; z-index: 2; display: flex; flex-direction: column; align-items: flex-start; }
#${LAYER_ID} .esd-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .28em; text-transform: uppercase; color: #8ea0dc; margin: 0 0 12px; white-space: nowrap; }
#${LAYER_ID} .esd-wordmark {
  font-family: "EduSportWordmark", "Inter", system-ui; font-weight: 400;
  font-variation-settings: "YEAR" 1979; font-size: clamp(34px, 4.4vw, 62px);
  line-height: .9; letter-spacing: 0; color: #eef2ff; margin: 0; white-space: nowrap;
}
#${LAYER_ID} .esd-label { margin: 16px 0 0; font-size: 14px; font-weight: 600; letter-spacing: .02em; color: #aeb9d8; }
#${LAYER_ID} .esd-brand, #${LAYER_ID} .esd-brand > * { border: 0 !important; box-shadow: none !important; }

/* Let the layer show through, and push Strapi's card into the right half. */
html[data-esd-auth] body,
html[data-esd-auth] #strapi { background: transparent !important; }
html[data-esd-auth] main {
  position: relative; z-index: 1; background: transparent !important;
  min-height: 100vh; display: grid; grid-template-columns: 58% 1fr; align-items: center;
}
html[data-esd-auth] main > div {
  grid-column: 2; justify-self: center; width: 100%; max-width: 430px;
  background: transparent !important; box-shadow: none !important; border: none !important;
  padding: 0 clamp(24px, 4vw, 64px) !important; box-sizing: border-box;
}
/* Logo lives in the brand panel now; hide the one Strapi renders in the card. */
html[data-esd-auth] main img[alt=""] { display: none !important; }
/* Left-align the header block. */
html[data-esd-auth] main h1 { text-align: left !important; }
/* Brand-colour the primary submit button. */
html[data-esd-auth] main button[type="submit"] { background: #2138b8 !important; border-color: #2138b8 !important; }

/* Romanian only for now: hide the language switcher, the top header/nav, and
   the shell's mobile action button on the login screen. */
html[data-esd-auth] #strapi header,
html[data-esd-auth] [aria-label="Select interface language"],
html[data-esd-auth] [aria-label="Deschide meniul"],
html[data-esd-auth] .esd-fab,
html[data-esd-auth] nav[aria-label],
html[data-esd-auth] #edusport-mobile-nav-root,
html[data-esd-auth] #edusport-savebar-root,
html[data-esd-auth] #edusport-shell-root,
html[data-esd-auth] #edusport-blocks-toolbar-extra-root { display: none !important; }

/* The card sits on our white panel; force readable (light-theme) form colours
   regardless of the admin's active theme. */
html[data-esd-auth] main h1 { color: #111827 !important; }
html[data-esd-auth] main label, html[data-esd-auth] main label span { color: #374151 !important; }
html[data-esd-auth] main input[type="email"],
html[data-esd-auth] main input[type="password"],
html[data-esd-auth] main input[type="text"] { background: #fff !important; border: 1px solid #d7dbe6 !important; color: #111827 !important; }
html[data-esd-auth] main input::placeholder { color: #9ca3af !important; }
/* Keep the form fluid within the card, but never widen Strapi's password
   show/hide button wrapper: widening it makes Strapi reserve a huge inline
   padding-right on the input (and mis-places the toggle). Only touch the
   form + the text inputs, not buttons/icons. */
html[data-esd-auth] main > div { width: 100% !important; box-sizing: border-box !important; }
html[data-esd-auth] main form { width: 100% !important; max-width: 100% !important; }
html[data-esd-auth] main input[type="email"],
html[data-esd-auth] main input[type="password"],
html[data-esd-auth] main input[type="text"] { width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
/* Left-align the header block (logo/title/subtitle). */
html[data-esd-auth] main > div > div:first-child { align-items: flex-start !important; text-align: left !important; }
/* Left-align the header block (logo/title/subtitle). */
html[data-esd-auth] main > div > div:first-child { align-items: flex-start !important; text-align: left !important; }

@media (max-width: 960px) {
  /* Mobile: plain white, just the EDUSPORT wordmark above the form. Fits without scroll. */
  html[data-esd-auth] #${LAYER_ID} { background: #fff; }
  html[data-esd-auth] #${LAYER_ID} .esd-navy,
  html[data-esd-auth] #${LAYER_ID} .esd-ribbon { display: none; }
  html[data-esd-auth] #${LAYER_ID} .esd-brand {
    top: 8vh; left: 0; right: 0; align-items: center; text-align: center; padding: 0 24px;
  }
  html[data-esd-auth] #${LAYER_ID} .esd-eyebrow { color: #6b7688; }
  html[data-esd-auth] #${LAYER_ID} .esd-wordmark { color: #0e1a3c; font-size: clamp(28px, 9vw, 46px); }
  html[data-esd-auth] #${LAYER_ID} .esd-label { display: none; }

  html[data-esd-auth], html[data-esd-auth] body { overflow-x: hidden !important; width: 100% !important; max-width: 100% !important; }
  html[data-esd-auth] main, html[data-esd-auth] main * { box-sizing: border-box !important; min-width: 0 !important; }
  html[data-esd-auth] #strapi { width: 100% !important; max-width: 100% !important; overflow-x: clip !important; }
  html[data-esd-auth] #strapi main {
    display: block !important; width: 100% !important; max-width: 100% !important;
    min-height: 100vh; margin: 0 !important; padding: 0 !important; overflow-x: clip !important;
  }
  html[data-esd-auth] #strapi main > div {
    width: min(100% - 36px, 360px) !important; max-width: 360px !important; min-width: 0 !important;
    margin: 0 auto !important; padding: 30vh 0 28px !important; overflow-x: clip !important; justify-self: initial;
  }
  html[data-esd-auth] #strapi main > div > div,
  html[data-esd-auth] #strapi main form,
  html[data-esd-auth] #strapi main form > div,
  html[data-esd-auth] #strapi main input[type="email"],
  html[data-esd-auth] #strapi main input[type="password"],
  html[data-esd-auth] #strapi main input[type="text"],
  html[data-esd-auth] #strapi main button[type="submit"] { width: 100% !important; max-width: 100% !important; }
}
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = AUTH_CSS;
  document.head.appendChild(style);
}

/**
 * Add/remove the brand layer based on the current route. Idempotent; safe to
 * call from the admin shell's rAF-batched tagger on every mutation.
 */
export function applyLoginBranding(): void {
  ensureStyle();
  const onAuth = window.location.pathname.startsWith('/admin/auth');
  const html = document.documentElement;

  if (onAuth) {
    if (!document.getElementById(LAYER_ID)) {
      const el = document.createElement('div');
      el.id = LAYER_ID;
      el.innerHTML = BRAND_INNER;
      document.body.insertBefore(el, document.body.firstChild);
    }
    if (!html.hasAttribute('data-esd-auth')) html.setAttribute('data-esd-auth', '1');
  } else {
    if (html.hasAttribute('data-esd-auth')) html.removeAttribute('data-esd-auth');
    document.getElementById(LAYER_ID)?.remove();
  }
}
