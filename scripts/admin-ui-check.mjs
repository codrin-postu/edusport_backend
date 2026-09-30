#!/usr/bin/env node
/**
 * Admin UI token checker.
 *
 * Flags, in src/admin/**\/*.{ts,tsx} (outside src/admin/ui/tokens.ts):
 *   - raw hex colours (#fff, #2138b8, #00000080);
 *   - rgb() / rgba() / hsl() / hsla() colours;
 *   - border-radius values that are not a radius token (var(--adm-radius-*)),
 *     in CSS strings (border-radius: 6px) and in React styles (borderRadius: 6).
 *     0 / none / inherit are allowed, and the save bar's own
 *     var(--adm-radius-savebar[-sheet|-dot]) (the approved exception).
 *
 * Usage:
 *   node scripts/admin-ui-check.mjs            report, always exits 0
 *   node scripts/admin-ui-check.mjs --strict   exit 1 when anything is flagged
 *   node scripts/admin-ui-check.mjs --list     also print every hit with line numbers
 *   node scripts/admin-ui-check.mjs --contrast also check WCAG AA of the token
 *                                              pairs in src/admin/ui/tokens.ts
 *
 * Baseline (phase 1, 2026-09-29): see BASELINE below and docs/admin-ui/PLAN.md.
 * Later phases migrate pages onto src/admin/ui and drive the total to zero;
 * src/admin/ui itself must stay at zero.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const ADMIN = join(ROOT, 'src', 'admin');
const TOKENS = join(ADMIN, 'ui', 'tokens.ts');

/**
 * Recorded at the end of phase 1 (before phase 1 the same scan gave 30 files,
 * 1173 hits). Update only when intentionally rebaselining.
 */
const BASELINE = { files: 28, hex: 889, rgb: 60, radius: 181, total: 1130 };

const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
const LIST = args.has('--list');
const CONTRAST = args.has('--contrast');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      out.push(...walk(p));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

// Hex colour: 3, 4, 6 or 8 hex digits, not part of an HTML entity (&#123;) or a longer word.
const HEX = /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g;
const RGB = /\b(?:rgba?|hsla?)\(/g;
// CSS: border-radius / border-top-left-radius etc.  JS: borderRadius / borderTopLeftRadius.
const RADIUS_CSS = /border(?:-(?:top|bottom)-(?:left|right))?-radius\s*:\s*([^;}"'`\n]+)/g;
const RADIUS_JS = /\bborder(?:(?:Top|Bottom)(?:Left|Right))?Radius\s*:\s*([^,\n]+)/g;
const RADIUS_OK = /^\s*(?:0(?:px)?|none|inherit|var\(--adm-radius-(?:none|sm|md|savebar(?:-sheet|-dot)?)\))\s*(?:!important)?\s*$/;

function cleanRadiusValue(v) {
  return v
    .trim()
    .replace(/[\s}]+$/, '')
    .replace(/^['"`]/, '')
    .replace(/['"`]$/, '')
    .trim();
}

function isAllowedRadius(raw) {
  const v = cleanRadiusValue(raw);
  if (RADIUS_OK.test(v)) return true;
  // Template-literal value built from a radius token: `var(--adm-radius-${k})`.
  if (/^var\(--adm-radius-\$\{[^}]+\}\)$/.test(v)) return true;
  return false;
}

function lineOf(text, index) {
  let n = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

function scan(file) {
  const text = readFileSync(file, 'utf8');
  const hits = { hex: [], rgb: [], radius: [] };
  for (const m of text.matchAll(HEX)) hits.hex.push({ line: lineOf(text, m.index), s: m[0] });
  for (const m of text.matchAll(RGB)) hits.rgb.push({ line: lineOf(text, m.index), s: m[0] });
  for (const re of [RADIUS_CSS, RADIUS_JS]) {
    for (const m of text.matchAll(re)) {
      if (!isAllowedRadius(m[1])) hits.radius.push({ line: lineOf(text, m.index), s: m[0].trim() });
    }
  }
  return hits;
}

const files = walk(ADMIN).filter((f) => f !== TOKENS).sort();
const rows = [];
const totals = { files: 0, hex: 0, rgb: 0, radius: 0, total: 0 };
for (const f of files) {
  const h = scan(f);
  const n = h.hex.length + h.rgb.length + h.radius.length;
  if (n === 0) continue;
  rows.push({ file: relative(ROOT, f).split(sep).join('/'), ...h, n });
  totals.files++;
  totals.hex += h.hex.length;
  totals.rgb += h.rgb.length;
  totals.radius += h.radius.length;
  totals.total += n;
}

rows.sort((a, b) => b.n - a.n || a.file.localeCompare(b.file));
const pad = (s, w) => String(s).padStart(w);
const width = Math.max(4, ...rows.map((r) => r.file.length));
console.log(`${'file'.padEnd(width)}  ${pad('hex', 5)} ${pad('rgb', 5)} ${pad('radius', 6)} ${pad('total', 6)}`);
for (const r of rows) {
  console.log(`${r.file.padEnd(width)}  ${pad(r.hex.length, 5)} ${pad(r.rgb.length, 5)} ${pad(r.radius.length, 6)} ${pad(r.n, 6)}`);
  if (LIST) {
    for (const k of ['hex', 'rgb', 'radius']) for (const x of r[k]) console.log(`    ${k.padEnd(6)} ${r.file}:${x.line}  ${x.s}`);
  }
}
console.log('');
console.log(`total    files ${totals.files}, hex ${totals.hex}, rgb ${totals.rgb}, radius ${totals.radius}, all ${totals.total}`);
console.log(
  `baseline files ${BASELINE.files}, hex ${BASELINE.hex}, rgb ${BASELINE.rgb}, radius ${BASELINE.radius}, all ${BASELINE.total} (phase 1, 2026-09-29)`,
);
const delta = totals.total - BASELINE.total;
console.log(`change   ${delta > 0 ? '+' : ''}${delta} against baseline`);

const uiHits = rows.filter((r) => r.file.startsWith('src/admin/ui/'));
if (uiHits.length) {
  console.log(`\nsrc/admin/ui must stay token-only; offending files: ${uiHits.map((r) => r.file).join(', ')}`);
}

/* ---- optional WCAG AA check of the token pairs ------------------------- */
async function contrast() {
  let mod;
  try {
    // Node 22.18+ strips TypeScript types natively.
    mod = await import(pathToFileURL(TOKENS).href);
  } catch (e) {
    console.log(`\ncontrast: could not load tokens.ts (${e.message}); needs Node 22.18+ type stripping.`);
    return true;
  }
  const lum = (hex) => {
    const h = hex.replace('#', '');
    const c = [0, 2, 4]
      .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => {
    const x = lum(a);
    const y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  let ok = true;
  console.log('\ncontrast (WCAG 2.1 AA: text 4.5, non-text 3.0)');
  for (const [name, t] of Object.entries(mod.THEMES)) {
    const checks = [];
    const surfaces = ['page', 'raised', 'subtle', 'sunken'];
    for (const k of ['primary', 'secondary', 'muted'])
      for (const s of surfaces) checks.push([`text.${k} on ${s}`, t.text[k], t.surface[s], 4.5]);
    checks.push(['text.onAccent on accent', t.text.onAccent, t.accent.default, 4.5]);
    checks.push(['text.onAccent on accent.hover', t.text.onAccent, t.accent.hover, 4.5]);
    checks.push(['accent on raised', t.accent.default, t.surface.raised, 4.5]);
    checks.push(['accent on accent.soft', t.accent.default, t.accent.soft, 4.5]);
    for (const s of ['raised', 'sunken']) {
      checks.push([`line.strong on ${s}`, t.line.strong, t.surface[s], 3]);
      checks.push([`focus on ${s}`, t.focus, t.surface[s], 3]);
    }
    for (const [tone, c] of Object.entries(t.status)) {
      checks.push([`${tone}.fg on ${tone}.bg`, c.fg, c.bg, 4.5]);
      checks.push([`${tone}.fg on raised`, c.fg, t.surface.raised, 4.5]);
    }
    const sb = t.savebar;
    checks.push(['savebar.text on savebar.surface', sb.text, sb.surface, 4.5]);
    checks.push(['savebar.textMuted on savebar.surface', sb.textMuted, sb.surface, 4.5]);
    checks.push(['savebar.onPrimary on savebar.primary', sb.onPrimary, sb.primary, 4.5]);
    checks.push(['savebar.onSuccess on savebar.success', sb.onSuccess, sb.success, 4.5]);
    // Calendar categories (shared with the website): text on the fill in every
    // theme; in dark, the fill must also stand out from the surface (1.4.11).
    for (const [cat, c] of Object.entries(t.category)) {
      checks.push([`cat.${cat}.fg on cat.${cat}`, c.fg, c.bg, 4.5]);
      if (t.colorScheme === 'dark') checks.push([`cat.${cat} on raised`, c.bg, t.surface.raised, 3]);
    }
    const fails = checks.filter(([, a, b, min]) => ratio(a, b) < min);
    const worst = checks.reduce((w, c) => (ratio(c[1], c[2]) / c[3] < ratio(w[1], w[2]) / w[3] ? c : w));
    console.log(
      `  ${name.padEnd(6)} ${checks.length} pairs, ${fails.length} below AA; tightest: ${worst[0]} ${ratio(worst[1], worst[2]).toFixed(2)} (min ${worst[3]})`,
    );
    for (const [label, a, b, min] of fails) console.log(`    FAIL ${label}: ${ratio(a, b).toFixed(2)} < ${min}`);
    if (fails.length) ok = false;
  }
  return ok;
}

let contrastOk = true;
if (CONTRAST) contrastOk = await contrast();

if (STRICT && (totals.total > 0 || !contrastOk)) process.exit(1);
if (uiHits.length && STRICT) process.exit(1);
