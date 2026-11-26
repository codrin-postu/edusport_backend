import { FLOWS, INTRO_STEPS, type FlowId, type TourStep } from './flows';

export type TourState =
  | { kind: 'idle' }
  | { kind: 'intro' | 'flow'; flow?: FlowId; steps: TourStep[]; index: number };

export type TourEvent =
  | { type: 'startIntro' }
  | { type: 'startFlow'; id: FlowId }
  | { type: 'next' }
  | { type: 'target'; anchor: string; via: 'click' | 'change' }
  | { type: 'exit' };

export type TourEffect = 'introDone' | { flowDone: FlowId } | 'left';
export interface TourResult { state: TourState; effect?: TourEffect }

const IDLE: TourState = { kind: 'idle' };
const SIDEBAR_ANCHORS = ['primii-pasi', 'ghid'];

export function currentStep(s: TourState): TourStep | null {
  return s.kind === 'idle' ? null : (s.steps[s.index] ?? null);
}

export function progressOf(s: TourState): number {
  return s.kind === 'idle' ? 0 : (s.index + 1) / s.steps.length;
}

export function needsMenuOpen(step: TourStep, phone: boolean): boolean {
  return phone && (SIDEBAR_ANCHORS.includes(step.anchor) || step.anchor.startsWith('row-'));
}

function advance(s: Exclude<TourState, { kind: 'idle' }>): TourResult {
  if (s.index + 1 < s.steps.length) return { state: { ...s, index: s.index + 1 } };
  if (s.kind === 'intro' || !s.flow) return { state: IDLE, effect: 'introDone' };
  return { state: IDLE, effect: { flowDone: s.flow } };
}

function startFlow(id: FlowId): TourResult {
  const steps = FLOWS.find((f) => f.id === id)?.steps;
  return steps ? { state: { kind: 'flow', flow: id, steps, index: 0 } } : { state: IDLE };
}

export function tourReducer(s: TourState, e: TourEvent): TourResult {
  if (e.type === 'startIntro') return { state: { kind: 'intro', steps: INTRO_STEPS, index: 0 } };
  if (e.type === 'startFlow') return startFlow(e.id);
  if (s.kind === 'idle') return { state: s };
  if (e.type === 'exit') return { state: IDLE, effect: 'left' };
  const step = currentStep(s);
  if (e.type === 'next') return step?.waitFor ? { state: s } : advance(s);
  return step && step.anchor === e.anchor ? advance(s) : { state: s };
}
