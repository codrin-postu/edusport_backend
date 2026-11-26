import type { FlowId } from './flows';

/** Example data served to the page while a flow runs; filled per flow by later tasks. */
export type Fixture = { method: 'GET'; match: RegExp; body: unknown };

export const FIXTURES: Partial<Record<FlowId, Fixture[]>> = {};
