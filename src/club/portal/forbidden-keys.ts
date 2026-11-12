/**
 * Every path in `value` whose last key is one of `keys`, as dotted paths with `*` for array items (`items.*.note`), once each.
 * `allow` lists paths (same notation) that may carry such a key.
 */
export function forbiddenPathsIn(value: unknown, keys: readonly string[], allow: readonly string[] = []): string[] {
  const found = new Set<string>();
  const walk = (v: unknown, path: string): void => {
    if (Array.isArray(v)) {
      for (const item of v) walk(item, path === '' ? '*' : `${path}.*`);
      return;
    }
    if (typeof v !== 'object' || v === null) return;
    for (const [key, inner] of Object.entries(v)) {
      const here = path === '' ? key : `${path}.${key}`;
      if (keys.includes(key) && !allow.includes(here)) found.add(here);
      walk(inner, here);
    }
  };
  walk(value, '');
  return [...found];
}
