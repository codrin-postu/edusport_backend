import { isFlowId, type FlowId } from './flows';

/** One admin's tour progress: when the intro was seen and when each flow was first finished (ISO dates). */
export type Progress = { introAt: string | null; flows: Partial<Record<FlowId, string>> };

const EMPTY = (): Progress => ({ introAt: null, flows: {} });
const isDate = (v: unknown): v is string => typeof v === 'string' && v !== '' && !Number.isNaN(Date.parse(v));

/** Anything malformed becomes empty; unknown flow ids and bad dates are dropped. */
export function parseProgress(raw: unknown): Progress {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return EMPTY();
  const { introAt, flows } = raw as { introAt?: unknown; flows?: unknown };
  const out = EMPTY();
  if (isDate(introAt)) out.introAt = introAt;
  if (typeof flows !== 'object' || flows === null || Array.isArray(flows)) return out;
  for (const [id, at] of Object.entries(flows)) if (isFlowId(id) && isDate(at)) out.flows[id] = at;
  return out;
}

/** The intro date is kept from the first time. */
export const markIntro = (p: Progress, at: string): Progress => ({ ...p, introAt: p.introAt ?? at });

/** A flow's date is kept from the first time; other flows stay. */
export const markFlow = (p: Progress, id: FlowId, at: string): Progress => ({ ...p, flows: { ...p.flows, [id]: p.flows[id] ?? at } });
