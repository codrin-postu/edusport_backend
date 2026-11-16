export const STRAPI_TOPBAR_ATTR = 'data-edusport-strapi-topbar';

const TOPBAR_MAX_HEIGHT = 160;

export interface TopbarFacts {
  tag: string;
  position: string;
  top: number;
  height: number;
  hasMenuButton: boolean;
}

/*
 * Strapi 5.52.1 renders its phone header as the MainNav itself (LeftMenu.mjs):
 * a sticky <nav> laid out as a row, flush with the top, short, holding the
 * burger button (aria-controls="burger-menu"). The desktop sidebar is the same
 * <nav> but tall; an in-page card header is not a <nav>.
 */
export function isStrapiTopbar(f: TopbarFacts): boolean {
  if (f.tag.toLowerCase() !== 'nav') return false;
  if (f.position !== 'sticky' && f.position !== 'fixed') return false;
  return f.hasMenuButton && f.top <= 1 && f.height > 0 && f.height <= TOPBAR_MAX_HEIGHT;
}
