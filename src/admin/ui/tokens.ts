/**
 * EduSport admin design tokens.
 *
 * The ONLY file in src/admin allowed to hold raw colour values. Every
 * component class in ./styles.ts reads these through custom properties
 * generated from the objects below: --palette-* (primitives), --theme-*
 * (semantic colours, per theme) and --ui-* (theme-independent scales).
 *
 * Two layers, like the website:
 *   1. PALETTE: the primitive colours, named scales plus the brand colours
 *      (--palette-<name>-<step>). The only place a hex value is written.
 *   2. The semantic themes (light, dark), emitted as --theme-*: surfaces,
 *      text, borders, primary, status, save bar, calendar categories. Each
 *      entry references PALETTE.
 *   Pages use the semantic variables; palette variables are for the reference
 *   page and for the rare one-off that has no semantic name yet.
 *
 * Adding a theme = adding one more `AdminTheme` object to THEMES. Nothing else
 * changes: tokensCss() emits one `[data-theme="<name>"]` block per entry.
 *
 * Contrast (WCAG 2.1 AA, verified with scripts/admin-ui-check.mjs --contrast):
 *   - text.primary / secondary / muted: at least 4.5:1 on page, raised, subtle
 *     and sunken surfaces;
 *   - status fg: at least 4.5:1 on its own bg and on raised;
 *   - primary: at least 4.5:1 on raised (links), on-primary at least 4.5:1 on primary;
 *   - line.strong (control borders: inputs, checkbox, switch track) and focus:
 *     at least 3:1 on raised and sunken (non-text contrast, 1.4.11);
 *   - line.default / line.subtle are decorative dividers (exempt), and
 *     text.disabled is exempt by definition;
 *   - save bar: text / muted text on its surface, on-primary / on-success on
 *     their buttons;
 *   - calendar categories and form tiles: fg at least 4.5:1 on its fill; in
 *     dark, the fill at least 3:1 on the raised surface.
 */

/* ---- primitive palette -------------------------------------------------- */

/**
 * Every raw colour in the admin, as named scales (lighter steps have lower
 * numbers) plus the website's brand colours. Emitted as
 * --palette-<name>-<step> (brand: --palette-brand-<name>).
 * The semantic themes below only reference these entries; nothing outside
 * this block writes a hex value.
 *
 *   blue    the former admin primary (#2138b8) family, light and dark
 *   indigo  Strapi's own primary, used by the Strapi-matching save bar only
 *   sky     info
 *   teal    the Contact form tile
 *   grey    every neutral: light surfaces, text and lines, Strapi's dark
 *           neutrals (dark surfaces, the save bar) and black for shadows
 *   green / amber / red  success / warning / danger, plus the save bar's states
 *   brand   the website's colours (navy, burgundy, orange, silver, rust,
 *           cream), shared by the calendar categories; *OnDark are the
 *           lifted fills the dark theme uses for them
 */
export const PALETTE = {
  blue: {
    50: '#eef1fb',
    100: '#cdd6f6',
    200: '#a9b7ff',
    300: '#8ea0ff',
    400: '#536cb6',
    500: '#3d4785',
    600: '#2138b8',
    700: '#1b2fa0',
    800: '#262c52',
    900: '#141a36',
    950: '#0d1233',
  },
  /** The admin primary (chosen 2026-09-30): a muted blue, calmer than blue.600. */
  steel: {
    50: '#ecf0f7',
    100: '#cfd9ea',
    200: '#b8c9e7',
    300: '#9fb6de',
    500: '#3d5a8f',
    600: '#324b78',
    800: '#34425f',
    900: '#1f2a40',
    950: '#0f1522',
  },
  indigo: {
    300: '#9b99ff',
    400: '#7b79ff',
    600: '#4945ff',
  },
  sky: {
    50: '#e9f2f9',
    100: '#bfd8ea',
    300: '#74bdf2',
    700: '#1d5f8f',
    800: '#2c5070',
    900: '#15293b',
  },
  grey: {
    0: '#ffffff',
    25: '#fafbfd',
    50: '#f7f8fa',
    75: '#f6f6f9',
    100: '#f0f0ff',
    125: '#f0f1f4',
    150: '#eef0f4',
    175: '#eaeaef',
    200: '#e0e2e8',
    250: '#d7dae1',
    300: '#c0c0cf',
    350: '#a4a9b4',
    375: '#a5a5ba',
    400: '#868c9b',
    450: '#77779a',
    500: '#666c7c',
    525: '#666687',
    600: '#4a4f5c',
    625: '#4a4a6a',
    700: '#3a3f4a',
    750: '#32324d',
    775: '#2a2a40',
    800: '#212134',
    825: '#1c1c2d',
    850: '#1b1d22',
    875: '#1a1a2b',
    900: '#181826',
    950: '#0f0f1c',
    1000: '#000000',
  },
  teal: {
    600: '#00838f',
  },
  green: {
    50: '#e7f3ec',
    100: '#bfe0cc',
    200: '#6fd49b',
    300: '#78c597',
    400: '#5cb176',
    600: '#328048',
    700: '#1f7a4d',
    800: '#2e5c3f',
    900: '#17301f',
  },
  amber: {
    50: '#fdf3e1',
    100: '#ecd3a2',
    200: '#f0bc5e',
    400: '#ed8936',
    500: '#d9822f',
    700: '#8a5300',
    800: '#6b5426',
    900: '#342914',
  },
  red: {
    50: '#faeceb',
    100: '#e6c3c1',
    300: '#ff8a83',
    400: '#f56565',
    500: '#d02b20',
    600: '#be3330',
    800: '#703236',
    900: '#3a1c21',
  },
  brand: {
    navy: '#0e1a3c',
    burgundy: '#6e4256',
    orange: '#ea7233',
    silver: '#9ca3af',
    rust: '#be3330',
    cream: '#fbf8f1',
    navyOnDark: '#536cb6',
    burgundyOnDark: '#93607a',
    rustOnDark: '#c93d39',
  },
} as const;

export type PaletteName = keyof typeof PALETTE;

const P = PALETTE;

/** rgba() of a palette hex, for shadows and overlays. */
function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/* ---- semantic themes ---------------------------------------------------- */

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface ToneColors {
  fg: string;
  bg: string;
  line: string;
}

/**
 * Calendar categories, shared with the website: the same five colours mark
 * a day or an entry in the admin calendar and on the site.
 */
export type CalendarCategory = 'scoala' | 'antrenament' | 'eveniment' | 'liber' | 'anulat';
export const CALENDAR_CATEGORIES: readonly CalendarCategory[] = ['scoala', 'antrenament', 'eveniment', 'liber', 'anulat'];

export interface CategoryColors {
  /** fill */
  bg: string;
  /** text on the fill */
  fg: string;
}

/**
 * Form tiles (Acasă feed, Formulare): the coloured square with a form's
 * initials. Config picks a colour by name (formDefs.ts); the fill and its
 * text come from the theme, as --theme-tile-<name> and --theme-tile-<name>-fg.
 */
export type TileColor = 'blue' | 'green' | 'teal' | 'amber';
export const TILE_COLORS: readonly TileColor[] = ['blue', 'green', 'teal', 'amber'];

export interface AdminTheme {
  /** CSS color-scheme, so native controls (date picker, scrollbars) follow. */
  colorScheme: 'light' | 'dark';
  surface: {
    /** page background behind windows */
    page: string;
    /** windows, sections, popovers */
    raised: string;
    /** rails, footers, table hover */
    subtle: string;
    /** field backgrounds, read-only rows */
    sunken: string;
    /** modal backdrop */
    overlay: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    disabled: string;
    onPrimary: string;
  };
  line: {
    /** window and section borders, header dividers */
    default: string;
    /** table row separators */
    subtle: string;
    /** control borders (inputs, checkbox, switch track) */
    strong: string;
  };
  primary: {
    default: string;
    hover: string;
    soft: string;
    softLine: string;
  };
  status: Record<StatusTone, ToneColors>;
  focus: string;
  shadow: {
    sm: string;
    md: string;
  };
  /**
   * The floating save bar (SaveBarView), on native content-manager pages and
   * custom pages alike. Deliberately Strapi's own palette, not the EduSport
   * primary: it is the approved Strapi-matching bar. In the light admin it is a
   * dark, inverse surface; in the dark admin a deeper one.
   */
  savebar: {
    surface: string;
    /** ghost button hover background */
    surfaceHover: string;
    line: string;
    /** ghost button hover border */
    lineHover: string;
    text: string;
    textMuted: string;
    primary: string;
    primaryHover: string;
    onPrimary: string;
    success: string;
    successHover: string;
    onSuccess: string;
    danger: string;
    /** status dot, "unsaved" state */
    warning: string;
    /** "!" and the spinner inside the status dot */
    onIcon: string;
    shadow: string;
  };
  /** Calendar category fills: --theme-cat-<name> and --theme-cat-<name>-fg. */
  category: Record<CalendarCategory, CategoryColors>;
  /** Form tiles: --theme-tile-<name> and --theme-tile-<name>-fg. */
  tile: Record<TileColor, CategoryColors>;
}

export const light: AdminTheme = {
  colorScheme: 'light',
  surface: {
    page: P.grey[150],
    raised: P.grey[0],
    subtle: P.grey[25],
    sunken: P.grey[50],
    overlay: alpha(P.blue[900], 0.35),
  },
  text: {
    primary: P.grey[850],
    secondary: P.grey[700],
    muted: P.grey[500],
    disabled: P.grey[350],
    onPrimary: P.grey[0],
  },
  line: {
    default: P.grey[200],
    subtle: P.grey[125],
    strong: P.grey[400],
  },
  primary: {
    default: P.steel[500],
    hover: P.steel[600],
    soft: P.steel[50],
    softLine: P.steel[100],
  },
  status: {
    success: { fg: P.green[700], bg: P.green[50], line: P.green[100] },
    warning: { fg: P.amber[700], bg: P.amber[50], line: P.amber[100] },
    danger: { fg: P.red[600], bg: P.red[50], line: P.red[100] },
    info: { fg: P.sky[700], bg: P.sky[50], line: P.sky[100] },
    neutral: { fg: P.grey[600], bg: P.grey[125], line: P.grey[250] },
  },
  focus: P.steel[500],
  shadow: {
    sm: `0 4px 16px ${alpha(P.blue[900], 0.06)}`,
    md: `0 12px 32px ${alpha(P.blue[900], 0.18)}`,
  },
  savebar: {
    surface: P.grey[800],
    surfaceHover: P.grey[750],
    line: P.grey[625],
    lineHover: P.grey[300],
    text: P.grey[75],
    textMuted: P.grey[300],
    primary: P.steel[300],
    primaryHover: P.steel[200],
    onPrimary: P.steel[950],
    success: P.green[600],
    successHover: P.green[400],
    onSuccess: P.grey[0],
    danger: P.red[500],
    warning: P.amber[500],
    onIcon: P.grey[0],
    shadow: `0 10px 32px ${alpha(P.grey[800], 0.32)}, 0 4px 12px ${alpha(P.grey[800], 0.16)}`,
  },
  category: {
    scoala: { bg: P.brand.navy, fg: P.brand.cream },
    antrenament: { bg: P.brand.burgundy, fg: P.brand.cream },
    eveniment: { bg: P.brand.orange, fg: P.brand.navy },
    liber: { bg: P.brand.silver, fg: P.brand.navy },
    anulat: { bg: P.brand.rust, fg: P.brand.cream },
  },
  // Amber takes navy text: white on it is 2.7:1.
  tile: {
    blue: { bg: P.blue[600], fg: P.grey[0] },
    green: { bg: P.green[700], fg: P.grey[0] },
    teal: { bg: P.teal[600], fg: P.grey[0] },
    amber: { bg: P.amber[500], fg: P.brand.navy },
  },
};

/**
 * Dark set, built on Strapi's own dark neutrals (#181826 page, #212134
 * surface, #32324d borders) so custom pages sit inside the dark admin without
 * a seam. The primary is lifted to a light periwinkle for contrast; text
 * on primary flips to a deep navy.
 */
export const dark: AdminTheme = {
  colorScheme: 'dark',
  surface: {
    page: P.grey[900],
    raised: P.grey[800],
    subtle: P.grey[825],
    sunken: P.grey[875],
    overlay: alpha(P.grey[1000], 0.6),
  },
  text: {
    primary: P.grey[175],
    secondary: P.grey[300],
    muted: P.grey[375],
    disabled: P.grey[525],
    onPrimary: P.steel[950],
  },
  line: {
    default: P.grey[750],
    subtle: P.grey[775],
    strong: P.grey[450],
  },
  primary: {
    default: P.steel[300],
    hover: P.steel[200],
    soft: P.steel[900],
    softLine: P.steel[800],
  },
  status: {
    success: { fg: P.green[200], bg: P.green[900], line: P.green[800] },
    warning: { fg: P.amber[200], bg: P.amber[900], line: P.amber[800] },
    danger: { fg: P.red[300], bg: P.red[900], line: P.red[800] },
    info: { fg: P.sky[300], bg: P.sky[900], line: P.sky[800] },
    neutral: { fg: P.grey[300], bg: P.grey[775], line: P.grey[625] },
  },
  focus: P.steel[300],
  shadow: {
    sm: `0 4px 16px ${alpha(P.grey[1000], 0.35)}`,
    md: `0 12px 32px ${alpha(P.grey[1000], 0.55)}`,
  },
  savebar: {
    surface: P.grey[950],
    surfaceHover: P.grey[875],
    line: P.grey[775],
    lineHover: P.grey[375],
    text: P.grey[100],
    textMuted: P.grey[375],
    primary: P.steel[300],
    primaryHover: P.steel[200],
    onPrimary: P.steel[950],
    success: P.green[400],
    successHover: P.green[300],
    onSuccess: P.grey[950],
    danger: P.red[400],
    warning: P.amber[400],
    onIcon: P.grey[0],
    shadow: `0 10px 32px ${alpha(P.grey[1000], 0.6)}, 0 4px 12px ${alpha(P.grey[1000], 0.4)}`,
  },
  // Navy, burgundy and rust are lifted so the fill still separates from the
  // dark surfaces (3:1); orange and silver already do. Text colours stay.
  category: {
    scoala: { bg: P.brand.navyOnDark, fg: P.brand.cream },
    antrenament: { bg: P.brand.burgundyOnDark, fg: P.brand.cream },
    eveniment: { bg: P.brand.orange, fg: P.brand.navy },
    liber: { bg: P.brand.silver, fg: P.brand.navy },
    anulat: { bg: P.brand.rustOnDark, fg: P.brand.cream },
  },
  // Blue and green are lifted off the dark surfaces (3:1), like the categories.
  tile: {
    blue: { bg: P.blue[400], fg: P.grey[0] },
    green: { bg: P.green[600], fg: P.grey[0] },
    teal: { bg: P.teal[600], fg: P.grey[0] },
    amber: { bg: P.amber[500], fg: P.brand.navy },
  },
};

export const THEMES = { light, dark } as const;
export type ThemeName = keyof typeof THEMES;
export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

/* ---- theme-independent scales ------------------------------------------ */

/** Square corners. sm is the default everywhere, md is for windows and modals. No pill radius. */
export const radius = {
  none: '0',
  sm: '4px',
  md: '6px',
} as const;

/**
 * The save bar's own corners: the one approved exception to the square rule
 * (see docs/admin-ui/PLAN.md). It matches Strapi's floating bar: 8px bar,
 * 12px top corners as a phone bottom sheet, a round status dot and spinner.
 * Use nowhere else.
 */
export const savebarRadius = {
  bar: '8px',
  sheet: '12px 12px 0 0',
  dot: '50%',
} as const;

/** 4px spacing scale: space[n] = n * 4px. */
export const space = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
} as const;

export interface TypeRole {
  size: string;
  weight: number;
  lineHeight: string;
  transform?: 'uppercase';
  tracking?: string;
}

export const type = {
  pageTitle: { size: '19px', weight: 800, lineHeight: '1.25', tracking: '-0.01em' },
  sectionTitle: { size: '11px', weight: 800, lineHeight: '1.3', transform: 'uppercase', tracking: '0.05em' },
  label: { size: '10.5px', weight: 700, lineHeight: '1.3', transform: 'uppercase', tracking: '0.05em' },
  body: { size: '13px', weight: 400, lineHeight: '1.5' },
  bodySm: { size: '12.5px', weight: 400, lineHeight: '1.45' },
  caption: { size: '11px', weight: 400, lineHeight: '1.4' },
} satisfies Record<string, TypeRole>;

export const font = {
  family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export const motion = {
  fast: '150ms',
  easing: 'ease',
} as const;

/* ---- CSS custom properties --------------------------------------------- */

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Status tone -> CSS name part: --theme-success, --theme-success-bg, --theme-success-border. */
const toneVar = (tone: string) => `--theme-${tone}`;

/** Surface key -> CSS name: page is the page background, raised the default surface. */
const SURFACE_VAR: Record<keyof AdminTheme['surface'], string> = {
  page: '--theme-bg',
  raised: '--theme-surface',
  subtle: '--theme-surface-subtle',
  sunken: '--theme-surface-sunken',
  overlay: '--theme-overlay',
};

/** Text key -> CSS name: primary is plain --theme-text. */
const TEXT_VAR: Record<keyof AdminTheme['text'], string> = {
  primary: '--theme-text',
  secondary: '--theme-text-secondary',
  muted: '--theme-text-muted',
  disabled: '--theme-text-disabled',
  onPrimary: '--theme-on-primary',
};

/** Colour + shadow variables for one theme, e.g. { '--theme-bg': '#eef0f4', ... }. */
export function themeVars(t: AdminTheme): Record<string, string> {
  const v: Record<string, string> = { '--theme-color-scheme': t.colorScheme };
  for (const [k, val] of Object.entries(t.surface)) v[SURFACE_VAR[k as keyof AdminTheme['surface']]] = val;
  for (const [k, val] of Object.entries(t.text)) v[TEXT_VAR[k as keyof AdminTheme['text']]] = val;
  v['--theme-border'] = t.line.default;
  v['--theme-border-subtle'] = t.line.subtle;
  v['--theme-border-strong'] = t.line.strong;
  v['--theme-primary'] = t.primary.default;
  v['--theme-primary-hover'] = t.primary.hover;
  v['--theme-primary-soft'] = t.primary.soft;
  v['--theme-primary-soft-line'] = t.primary.softLine;
  for (const [tone, c] of Object.entries(t.status)) {
    v[toneVar(tone)] = c.fg;
    v[`${toneVar(tone)}-bg`] = c.bg;
    v[`${toneVar(tone)}-border`] = c.line;
  }
  v['--theme-focus'] = t.focus;
  v['--theme-shadow-sm'] = t.shadow.sm;
  v['--theme-shadow-md'] = t.shadow.md;
  for (const [k, val] of Object.entries(t.savebar)) v[`--theme-savebar-${kebab(k)}`] = val;
  for (const [k, c] of Object.entries(t.category)) {
    v[`--theme-cat-${k}`] = c.bg;
    v[`--theme-cat-${k}-fg`] = c.fg;
  }
  for (const [k, c] of Object.entries(t.tile)) {
    v[`--theme-tile-${k}`] = c.bg;
    v[`--theme-tile-${k}-fg`] = c.fg;
  }
  return v;
}

/** The primitive palette as variables: --palette-blue-600, --palette-brand-navy, ... */
export function paletteVars(): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [name, scale] of Object.entries(PALETTE)) {
    for (const [step, hex] of Object.entries(scale)) v[`--palette-${name}-${kebab(step)}`] = hex;
  }
  return v;
}

/**
 * Theme-independent variables of the component library (--ui-*): radius,
 * spacing, type, font, motion. The palette (--palette-*) rides along.
 */
export function scaleVars(): Record<string, string> {
  const v: Record<string, string> = { ...paletteVars() };
  for (const [k, val] of Object.entries(radius)) v[`--ui-radius-${k}`] = val;
  v['--ui-radius-savebar'] = savebarRadius.bar;
  v['--ui-radius-savebar-sheet'] = savebarRadius.sheet;
  v['--ui-radius-savebar-dot'] = savebarRadius.dot;
  for (const [k, val] of Object.entries(space)) v[`--ui-space-${k}`] = val;
  for (const [k, r] of Object.entries(type) as [string, TypeRole][]) {
    const n = kebab(k);
    v[`--ui-fs-${n}`] = r.size;
    v[`--ui-fw-${n}`] = String(r.weight);
    v[`--ui-lh-${n}`] = r.lineHeight;
    v[`--ui-ls-${n}`] = r.tracking ?? 'normal';
  }
  v['--ui-font'] = font.family;
  v['--ui-font-mono'] = font.mono;
  v['--ui-motion-fast'] = motion.fast;
  v['--ui-easing'] = motion.easing;
  return v;
}

function block(selector: string, vars: Record<string, string>, extra = ''): string {
  const body = Object.entries(vars)
    .map(([k, val]) => `${k}:${val};`)
    .join('');
  return `${selector}{${body}${extra}}`;
}

/** The theme attribute, on <html> (set by useAdminTheme) or on any element. */
export const THEME_ATTR = 'data-theme';

/**
 * An outermost `.ui-root`: one not nested in another. Nested roots (a gallery
 * inside a page) inherit the variables instead of redeclaring them, so a
 * wrapper that previews another theme reaches everything inside it. The
 * :where() keeps the specificity at one class.
 */
const OUTER_ROOT = '.ui-root:not(:where(.ui-root .ui-root))';

/**
 * All custom-property blocks. Nothing is defined on :root or the page: the
 * variables exist only on `.ui-root` (every surface we render carries it), so
 * none of them leak into Strapi's own UI.
 *
 *   - scales + palette on every outermost .ui-root;
 *   - one block per theme. The light set is also the default when no theme
 *     attribute is set, so the first paint is never unstyled. Each theme block
 *     applies to an outermost root under <html data-theme="<name>"> (weight of
 *     one class, so it beats the default by order), and, winning over <html>,
 *     to a root that carries the attribute itself or to any element with the
 *     attribute inside a root (the reference page previews a theme this way).
 */
export function tokensCss(): string {
  const out = [block(OUTER_ROOT, scaleVars())];
  for (const name of THEME_NAMES) {
    const t = THEMES[name];
    const attr = `[${THEME_ATTR}="${name}"]`;
    const sel = [
      ...(name === 'light' ? [OUTER_ROOT] : []),
      `:where(:root${attr}) ${OUTER_ROOT}`,
      `${OUTER_ROOT}${attr}`,
      `.ui-root ${attr}`,
    ].join(',');
    out.push(block(sel, themeVars(t)));
  }
  return out.join('\n');
}
