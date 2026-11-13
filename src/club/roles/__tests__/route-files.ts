import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const API = join(__dirname, '../../../api');
export type Route = { method: string; path: string; config?: { policies?: unknown[] } };
export type LoadedRoute = Route & { file: string };

/** Every custom route file under src/api/*\/routes; default core routers are only source-checked. */
export async function loadRoutes(): Promise<{ files: string[]; routes: LoadedRoute[] }> {
  const files: string[] = [];
  const routes: LoadedRoute[] = [];
  for (const api of readdirSync(API)) {
    let names: string[] = [];
    try { names = readdirSync(join(API, api, 'routes')).filter((f) => f.endsWith('.ts')); } catch { continue; }
    for (const name of names) {
      const file = join(API, api, 'routes', name);
      files.push(file);
      if (readFileSync(file, 'utf8').includes('createCoreRouter')) continue;
      const mod = (await import(file)).default as { routes: Route[] };
      for (const r of mod.routes) routes.push({ ...r, file: `${api}/routes/${name}` });
    }
  }
  return { files, routes };
}

