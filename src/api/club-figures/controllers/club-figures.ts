/**
 * Cifre club: one public read (the core router) + a narrow admin read/write.
 *
 * This single type is the only place the club numbers are written. Pages that
 * show them keep a list of ids and look the value up here, so "ani de
 * activitate" cannot be 10+ on one page and 14+ on another, which is exactly
 * what happened while the homepage and Istoric each kept their own list.
 *
 * Public read is the standard core route: GET /api/club-figures. The site
 * authenticates with its read API token, like every other content type.
 *
 * Admin (`/api/cifre-club`, `global::is-admin`) is the custom "Pagina
 * principală" page's data source, following the navigation and announcement
 * pattern: content api routes with auth disabled, guarded by the policy, so the
 * admin fetch client's Bearer token is the only way in. The single type is
 * hidden from the content-manager, so this is the only write path.
 */
import { factories } from '@strapi/strapi';

const UID = 'api::club-figures.club-figures';

interface Figure {
  id: string;
  value: string;
  label: string;
}

const MAX_FIGURES = 40;

/** Keeps ids usable as stable keys: lowercase letters, digits and dashes. */
const slugify = (raw: string): string =>
  String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

async function loadFigures(): Promise<Figure[]> {
  const entry: any = await strapi.documents(UID).findFirst();
  const rows = entry?.figures;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r: any) => r && typeof r === 'object' && typeof r.id === 'string' && r.id.trim() !== '')
    .map((r: any) => ({
      id: String(r.id),
      value: String(r.value ?? ''),
      label: String(r.label ?? ''),
    }));
}

export default factories.createCoreController(UID, () => ({
  /** GET /api/cifre-club  ->  { data: { figures: Figure[] } } */
  async adminList(ctx: any) {
    ctx.body = { data: { figures: await loadFigures() } };
  },

  /**
   * PUT /api/cifre-club
   * body: { figures: { id?: string, value: string, label: string }[] }
   * The whole ordered list is replaced. A row without an id gets one derived
   * from its label, so the admin page can add a figure without inventing keys.
   */
  async adminUpdate(ctx: any) {
    const body = ctx.request?.body?.data ?? ctx.request?.body ?? {};
    const incoming = body.figures;
    if (!Array.isArray(incoming)) {
      ctx.badRequest('Lipsește lista de cifre.');
      return;
    }
    if (incoming.length > MAX_FIGURES) {
      ctx.badRequest(`Prea multe cifre, maximum ${MAX_FIGURES}.`);
      return;
    }

    const used = new Set<string>();
    const next: Figure[] = [];

    for (const row of incoming) {
      if (!row || typeof row !== 'object') {
        ctx.badRequest('Fiecare cifră trebuie să fie un obiect.');
        return;
      }
      const value = String((row as any).value ?? '').trim();
      const label = String((row as any).label ?? '').trim();
      if (value === '' && label === '') continue;

      let id = slugify(String((row as any).id ?? '')) || slugify(label) || slugify(value);
      if (!id) id = 'cifra';
      let unique = id;
      let n = 2;
      while (used.has(unique)) {
        unique = `${id}-${n}`;
        n += 1;
      }
      used.add(unique);
      next.push({ id: unique, value, label });
    }

    const entry: any = await strapi.documents(UID).findFirst();
    if (entry) {
      await strapi.documents(UID).update({ documentId: entry.documentId, data: { figures: next } as any });
    } else {
      await strapi.documents(UID).create({ data: { figures: next } as any });
    }

    ctx.body = { data: { figures: await loadFigures() } };
  },
}));
