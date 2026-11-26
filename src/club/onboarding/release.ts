const trim = (p: string): string => (p.length > 1 ? p.replace(/\/+$/, '') : p);

/**
 * Whether the fetch guard may come off after a flow was left. Only once the page really is Primii pași (`target`, with or without the /admin prefix);
 * after the wait cap, also on any route change away from the page the flow ended on (`start`). Never on a timer alone.
 */
export function canReleaseGuard(now: { pathname: string; start: string; target: string; capped: boolean }): boolean {
  const here = trim(now.pathname);
  const target = trim(now.target);
  if (here === target || here === `/admin${target}`) return true;
  return now.capped && here !== trim(now.start);
}
