/**
 * One descriptor per synced form.
 *
 * Every descriptor knows how to fetch its rows, build its header, and render a
 * single document. The LAST column of every row is the `documentId` — that is
 * the sync key `sync.ts` looks rows up by.
 *
 * Column logic is NOT duplicated here: it comes from `matrix.ts`, which the CSV
 * exports use too, so the Sheet and the CSV can never disagree about columns.
 *
 * Plan caching: `buildHeader()` resolves the current column plan (form config +
 * every custom answer key present in the data) and caches it briefly; `toRow()`
 * renders against that cached plan. Always `await buildHeader()` (directly or
 * via `sync.ensureHeader`) before calling `toRow()` — `sync.ts` does.
 */
import { sanitizeTabName } from './client';
import type { ColumnPlan, RowLike } from './matrix';
import { contactPlan, inscrieriPlan, parteneriPlan, voluntariPlan } from './matrix';

export type FormKey = 'inscrieri' | 'voluntari' | 'parteneri' | 'contact';

export const FORM_KEYS: FormKey[] = ['inscrieri', 'voluntari', 'parteneri', 'contact'];

export function isFormKey(v: unknown): v is FormKey {
  return typeof v === 'string' && (FORM_KEYS as string[]).includes(v);
}

/**
 * How a form decides WHICH tab a row belongs in.
 *
 * A form without a `partition` is single-tab: every row goes to `link.tab`,
 * exactly as before. A form WITH a partition is multi-tab: the tab name is
 * derived from a field on the row itself, and `link.tab` is ignored entirely
 * (see the `tab` comment in sheet-link/schema.json).
 */
export interface Partition {
  /** The row field the tab name is derived from. */
  field: string;
  /** Tab used by rows whose `field` is empty or null. */
  fallbackTab: string;
  /** Resolve one row's tab name, already sanitised for the Sheets API. */
  tabFor(doc: RowLike): string;
}

export interface FormDescriptor {
  key: FormKey;
  uid: string;
  label: string;
  /** Present only on multi-tab forms. */
  readonly partition?: Partition;
  /** Every row in the database, oldest first (the order they are written in). */
  fetchAll(): Promise<RowLike[]>;
  /** Resolve + cache the current column plan, returning its header. */
  buildHeader(): Promise<string[]>;
  /** Render one document against the cached plan. */
  toRow(doc: RowLike): string[];
  /** Index of the documentId column — always the last one. */
  readonly idIndex: number;
}

/** How long a resolved column plan is reused before it is rebuilt. */
const PLAN_TTL_MS = 15_000;

/** Hard cap on rows read from the database in one pass (matches the CSV export). */
export const ROW_LIMIT = 5000;

/**
 * Tab used by Înscrieri rows carrying no season. Chosen over a Romanian-
 * diacritic name so the tab title survives every A1 range, URL and CSV export
 * path untouched.
 */
export const INSCRIERI_FALLBACK_TAB = 'fara-sezon';

/** Build a "tab name comes from this field" rule. */
function byField(field: string, fallbackTab: string): Partition {
  return {
    field,
    fallbackTab,
    tabFor: (doc) => sanitizeTabName(doc?.[field], fallbackTab),
  };
}

interface Spec {
  key: FormKey;
  uid: string;
  label: string;
  plan: (rows: RowLike[]) => Promise<ColumnPlan>;
  partition?: Partition;
}

const SPECS: Spec[] = [
  {
    key: 'inscrieri',
    uid: 'api::registration-submission.registration-submission',
    label: 'Înscrieri',
    plan: inscrieriPlan,
    // One tab per season: "2025-2026", "2024-2025", … and `fara-sezon` for the
    // rows that have none. Every other form stays single-tab.
    partition: byField('season', INSCRIERI_FALLBACK_TAB),
  },
  {
    key: 'voluntari',
    uid: 'api::volunteer-submission.volunteer-submission',
    label: 'Voluntari',
    plan: voluntariPlan,
  },
  {
    key: 'parteneri',
    uid: 'api::partner-submission.partner-submission',
    label: 'Parteneri',
    plan: parteneriPlan,
  },
  {
    key: 'contact',
    uid: 'api::contact-submission.contact-submission',
    label: 'Contact',
    plan: contactPlan,
  },
];

class Descriptor implements FormDescriptor {
  private cached: { plan: ColumnPlan; at: number } | null = null;

  constructor(private readonly spec: Spec) {}

  get key(): FormKey {
    return this.spec.key;
  }

  get uid(): string {
    return this.spec.uid;
  }

  get label(): string {
    return this.spec.label;
  }

  get partition(): Partition | undefined {
    return this.spec.partition;
  }

  get idIndex(): number {
    // The ID column is always last; -1 until a plan has been resolved.
    return this.cached ? this.cached.plan.header.length - 1 : -1;
  }

  async fetchAll(): Promise<RowLike[]> {
    const docs = await strapi.documents(this.spec.uid as any).findMany({
      sort: { submittedAt: 'asc' } as any,
      limit: ROW_LIMIT,
    });
    return (docs ?? []) as unknown as RowLike[];
  }

  async count(): Promise<number> {
    try {
      return await strapi.documents(this.spec.uid as any).count({});
    } catch {
      return 0;
    }
  }

  /** Resolve the column plan over every row currently in the database. */
  async resolvePlan(rows?: RowLike[]): Promise<ColumnPlan> {
    if (!rows && this.cached && Date.now() - this.cached.at < PLAN_TTL_MS) return this.cached.plan;
    const source = rows ?? (await this.fetchAll());
    const plan = await this.spec.plan(source);
    this.cached = { plan, at: Date.now() };
    return plan;
  }

  async buildHeader(): Promise<string[]> {
    return (await this.resolvePlan()).header;
  }

  toRow(doc: RowLike): string[] {
    if (!this.cached) {
      throw new Error(`[sheets] toRow(${this.spec.key}) called before buildHeader()`);
    }
    return this.cached.plan.row(doc);
  }

  invalidate(): void {
    this.cached = null;
  }
}

const REGISTRY: Record<FormKey, Descriptor> = SPECS.reduce(
  (acc, spec) => {
    acc[spec.key] = new Descriptor(spec);
    return acc;
  },
  {} as Record<FormKey, Descriptor>,
);

export function getForm(key: FormKey): Descriptor {
  return REGISTRY[key];
}

export function allForms(): Descriptor[] {
  return FORM_KEYS.map((k) => REGISTRY[k]);
}

export type { Descriptor };
