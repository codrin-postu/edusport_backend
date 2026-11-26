/** The guided flows of the admin tour, in menu order. The catalogue of steps joins this file in the next task. */
export const FLOW_IDS = [
  'inscriere', 'sportiv', 'grupa', 'prezenta', 'plata', 'sedinta', 'anunt', 'parinte', 'functii', 'pagina', 'preturi', 'membru',
] as const;

export type FlowId = (typeof FLOW_IDS)[number];

export const isFlowId = (v: unknown): v is FlowId => typeof v === 'string' && (FLOW_IDS as readonly string[]).includes(v);
