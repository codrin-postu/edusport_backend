/**
 * The path as Strapi's admin router sees it: @koa/router matches without regard to case or one trailing slash, so every middleware
 * that guards an admin route normalises first (B3 H1). Decodes percent-encoding once; an undecodable path is matched as it is.
 */
export function normalizeAdminPath(path: string): string {
  let p = path;
  try {
    p = decodeURIComponent(p);
  } catch {
    /* matched as it is */
  }
  p = p.toLowerCase();
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}
