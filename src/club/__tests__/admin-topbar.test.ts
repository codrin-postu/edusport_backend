import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STRAPI_TOPBAR_ATTR, isStrapiTopbar } from '../admin-topbar';

const phoneHeader = { tag: 'NAV', position: 'sticky', top: 0, height: 64, hasMenuButton: true };

describe('isStrapiTopbar', () => {
  it('matches the Strapi phone header (short sticky nav with the menu button)', () => {
    expect(isStrapiTopbar(phoneHeader)).toBe(true);
  });

  it('rejects the desktop sidebar (tall sticky nav, menu button hidden inside)', () => {
    expect(isStrapiTopbar({ ...phoneHeader, height: 900 })).toBe(false);
  });

  it('rejects an in-page card header', () => {
    expect(isStrapiTopbar({ tag: 'DIV', position: 'static', top: 240, height: 64, hasMenuButton: false })).toBe(false);
    expect(isStrapiTopbar({ ...phoneHeader, tag: 'DIV' })).toBe(false);
  });

  it('rejects a short nav without the menu button', () => {
    expect(isStrapiTopbar({ ...phoneHeader, hasMenuButton: false })).toBe(false);
  });
});

describe('phone top bar wiring', () => {
  const app = readFileSync('src/admin/app.tsx', 'utf8');
  const nav = readFileSync('src/admin/MobileNav.tsx', 'utf8');
  const css = nav.slice(nav.indexOf('const NAV_CSS = `') + 'const NAV_CSS = `'.length, nav.indexOf('`;', nav.indexOf('const NAV_CSS')));

  it('tags the Strapi header in app.tsx', () => {
    expect(app).toContain('STRAPI_TOPBAR_ATTR');
  });

  it('hides the tagged header on phones and shows the EduSport bar', () => {
    const media = css.slice(css.indexOf('@media ${tabletQuery}'));
    expect(media).toContain('[data-edusport-strapi-topbar]');
    expect(media).toContain('display:none');
    expect(media).toContain('nav:has(button[aria-controls="burger-menu"]){display:none !important}');
    expect(css).toContain('.edu-mnav-bar');
    expect(css).toContain('--ui-topbar');
  });

  it('keeps NAV_CSS free of backticks', () => {
    expect(css).not.toContain('`');
    expect(css.length).toBeGreaterThan(100);
  });
});
