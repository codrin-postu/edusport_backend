/** The browser address of an admin router path (`/plugins/...`): the Strapi admin basename `/admin` in front. For window.open and plain hrefs; `<Link>` and navigate take the router path. */
export function eduLinkHref(to: string): string {
  return '/admin' + to;
}
