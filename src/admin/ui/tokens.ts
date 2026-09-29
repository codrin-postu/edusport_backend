/**
 * EduSport admin design tokens.
 *
 * The ONLY file under src/admin/ui allowed to hold raw colour values. Every
 * component class in ./styles.ts reads these through var(--adm-*) custom
 * properties, generated from the objects below.
 *
 * Adding a theme = adding one more `AdminTheme` object to THEMES. Nothing else
 * changes: styles.ts emits a `:root[data-adm-theme="<name>"]` block per entry.
 *
 * Contrast (WCAG 2.1 AA, verified with scripts/admin-ui-check.mjs --contrast):
 *   - text.primary / secondary / muted: at least 4.5:1 on page, raised, subtle
 *     and sunken surfaces;
 *   - status fg: at least 4.5:1 on its own bg and on raised;
 *   - accent: at least 4.5:1 on raised (links), on-accent at least 4.5:1 on accent;
 *   - line.strong (control borders: inputs, checkbox, switch track) and focus:
 *     at least 3:1 on raised and sunken (non-text contrast, 1.4.11);
 *   - line.default / line.subtle are decorative dividers (exempt), and
 *     text.disabled is exempt by definition.
 */

export type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

export interface ToneColors {
  fg: string;
  bg: string;
  line: string;
}

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
    onAccent: string;
  };
  line: {
    /** window and section borders, header dividers */
    default: string;
    /** table row separators */
    subtle: string;
    /** control borders (inputs, checkbox, switch track) */
    strong: string;
  };
  accent: {
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
}

export const light: AdminTheme = {
  colorScheme: 'light',
  surface: {
    page: '#eef0f4',
    raised: '#ffffff',
    subtle: '#fafbfd',
    sunken: '#f7f8fa',
    overlay: 'rgba(20, 26, 54, 0.35)',
  },
  text: {
    primary: '#1b1d22',
    secondary: '#3a3f4a',
    muted: '#666c7c',
    disabled: '#a4a9b4',
    onAccent: '#ffffff',
  },
  line: {
    default: '#e0e2e8',
    subtle: '#f0f1f4',
    strong: '#868c9b',
  },
  accent: {
    default: '#2138b8',
    hover: '#1b2fa0',
    soft: '#eef1fb',
    softLine: '#cdd6f6',
  },
  status: {
    ok: { fg: '#1f7a4d', bg: '#e7f3ec', line: '#bfe0cc' },
    warn: { fg: '#8a5300', bg: '#fdf3e1', line: '#ecd3a2' },
    danger: { fg: '#be3330', bg: '#faeceb', line: '#e6c3c1' },
    info: { fg: '#1d5f8f', bg: '#e9f2f9', line: '#bfd8ea' },
    neutral: { fg: '#4a4f5c', bg: '#f0f1f4', line: '#d7dae1' },
  },
  focus: '#2138b8',
  shadow: {
    sm: '0 4px 16px rgba(20, 26, 54, 0.06)',
    md: '0 12px 32px rgba(20, 26, 54, 0.18)',
  },
};

/**
 * Dark set, built on Strapi's own dark neutrals (#181826 page, #212134
 * surface, #32324d borders) so custom pages sit inside the dark admin without
 * a seam. The navy accent is lifted to a light periwinkle for contrast; text
 * on accent flips to a deep navy.
 */
export const dark: AdminTheme = {
  colorScheme: 'dark',
  surface: {
    page: '#181826',
    raised: '#212134',
    subtle: '#1c1c2d',
    sunken: '#1a1a2b',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
  text: {
    primary: '#eaeaef',
    secondary: '#c0c0cf',
    muted: '#a5a5ba',
    disabled: '#666687',
    onAccent: '#0d1233',
  },
  line: {
    default: '#32324d',
    subtle: '#2a2a40',
    strong: '#77779a',
  },
  accent: {
    default: '#8ea0ff',
    hover: '#a9b7ff',
    soft: '#262c52',
    softLine: '#3d4785',
  },
  status: {
    ok: { fg: '#6fd49b', bg: '#17301f', line: '#2e5c3f' },
    warn: { fg: '#f0bc5e', bg: '#342914', line: '#6b5426' },
    danger: { fg: '#ff8a83', bg: '#3a1c21', line: '#703236' },
    info: { fg: '#74bdf2', bg: '#15293b', line: '#2c5070' },
    neutral: { fg: '#c0c0cf', bg: '#2a2a40', line: '#4a4a6a' },
  },
  focus: '#8ea0ff',
  shadow: {
    sm: '0 4px 16px rgba(0, 0, 0, 0.35)',
    md: '0 12px 32px rgba(0, 0, 0, 0.55)',
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

/** Colour + shadow variables for one theme, e.g. { '--adm-surface-page': '#eef0f4', ... }. */
export function themeVars(t: AdminTheme): Record<string, string> {
  const v: Record<string, string> = { '--adm-color-scheme': t.colorScheme };
  for (const [k, val] of Object.entries(t.surface)) v[`--adm-surface-${kebab(k)}`] = val;
  for (const [k, val] of Object.entries(t.text)) v[`--adm-text-${kebab(k)}`] = val;
  v['--adm-line'] = t.line.default;
  v['--adm-line-subtle'] = t.line.subtle;
  v['--adm-line-strong'] = t.line.strong;
  v['--adm-accent'] = t.accent.default;
  v['--adm-accent-hover'] = t.accent.hover;
  v['--adm-accent-soft'] = t.accent.soft;
  v['--adm-accent-soft-line'] = t.accent.softLine;
  for (const [tone, c] of Object.entries(t.status)) {
    v[`--adm-${tone}-fg`] = c.fg;
    v[`--adm-${tone}-bg`] = c.bg;
    v[`--adm-${tone}-line`] = c.line;
  }
  v['--adm-focus'] = t.focus;
  v['--adm-shadow-sm'] = t.shadow.sm;
  v['--adm-shadow-md'] = t.shadow.md;
  return v;
}

/** Theme-independent variables: radius, spacing, type, font, motion. */
export function scaleVars(): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [k, val] of Object.entries(radius)) v[`--adm-radius-${k}`] = val;
  for (const [k, val] of Object.entries(space)) v[`--adm-space-${k}`] = val;
  for (const [k, r] of Object.entries(type) as [string, TypeRole][]) {
    const n = kebab(k);
    v[`--adm-fs-${n}`] = r.size;
    v[`--adm-fw-${n}`] = String(r.weight);
    v[`--adm-lh-${n}`] = r.lineHeight;
    v[`--adm-ls-${n}`] = r.tracking ?? 'normal';
  }
  v['--adm-font'] = font.family;
  v['--adm-font-mono'] = font.mono;
  v['--adm-motion-fast'] = motion.fast;
  v['--adm-easing'] = motion.easing;
  return v;
}

function block(selector: string, vars: Record<string, string>, extra = ''): string {
  const body = Object.entries(vars)
    .map(([k, val]) => `${k}:${val};`)
    .join('');
  return `${selector}{${body}${extra}}`;
}

/**
 * All custom-property blocks: the scales on :root, then one block per theme.
 * The light set also applies when no theme attribute is set yet, so the first
 * paint is never unstyled. The theme blocks match the attribute on any
 * element, not only <html>, so a wrapper can preview another theme (the
 * reference page does); normally only <html data-adm-theme> carries it.
 */
export function tokensCss(): string {
  const out = [block(':root', scaleVars())];
  for (const name of THEME_NAMES) {
    const t = THEMES[name];
    const sel = name === 'light' ? `:root,[data-adm-theme="light"]` : `[data-adm-theme="${name}"]`;
    out.push(block(sel, themeVars(t)));
  }
  return out.join('\n');
}
