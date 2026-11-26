import { describe, expect, it } from 'vitest';
import { INTRO_STEPS, type TourStep } from '../flows';
import { currentStep, needsMenuOpen, progressOf, tourReducer, type TourState } from '../machine';

const steps: TourStep[] = [
  { anchor: 'a', where: 'w', title: 'A', waitFor: 'click' },
  { anchor: 'b', where: 'w', title: 'B' },
  { anchor: 'c', where: 'w', title: 'C', waitFor: 'click', final: true },
];
const flowAt = (index: number): TourState => ({ kind: 'flow', flow: 'inscriere', steps, index });
const idle: TourState = { kind: 'idle' };

describe('tourReducer', () => {
  it('starts the intro on its first step', () => {
    const { state } = tourReducer(idle, { type: 'startIntro' });
    expect(state).toEqual({ kind: 'intro', steps: INTRO_STEPS, index: 0 });
  });

  it('stays idle when a flow has no steps', () => {
    expect(tourReducer(idle, { type: 'startFlow', id: 'membru' }).state).toEqual(idle);
  });

  it('ignores next on a step with waitFor', () => {
    expect(tourReducer(flowAt(0), { type: 'next' }).state).toEqual(flowAt(0));
  });

  it('advances next on a plain step', () => {
    expect(tourReducer(flowAt(1), { type: 'next' }).state).toEqual(flowAt(2));
  });

  it('advances on the current anchor and ignores others', () => {
    expect(tourReducer(flowAt(0), { type: 'target', anchor: 'a', via: 'click' }).state).toEqual(flowAt(1));
    expect(tourReducer(flowAt(0), { type: 'target', anchor: 'zzz', via: 'click' }).state).toEqual(flowAt(0));
  });

  it('completes the flow on target of the final step', () => {
    const r = tourReducer(flowAt(2), { type: 'target', anchor: 'c', via: 'click' });
    expect(r).toEqual({ state: idle, effect: { flowDone: 'inscriere' } });
  });

  it('completes the intro on next of the last intro step', () => {
    const last: TourState = { kind: 'intro', steps: INTRO_STEPS, index: INTRO_STEPS.length - 1 };
    expect(tourReducer(last, { type: 'next' })).toEqual({ state: idle, effect: 'introDone' });
  });

  it('exit leaves with no done effect', () => {
    expect(tourReducer(flowAt(1), { type: 'exit' })).toEqual({ state: idle, effect: 'left' });
  });
});

describe('selectors', () => {
  it('currentStep and progressOf', () => {
    expect(currentStep(idle)).toBeNull();
    expect(currentStep(flowAt(1))).toBe(steps[1]);
    expect(progressOf(flowAt(1))).toBeCloseTo(2 / 3);
    expect(progressOf(idle)).toBe(0);
  });

  it('needsMenuOpen only for sidebar anchors on phone', () => {
    const at = (anchor: string): TourStep => ({ anchor, where: 'w', title: 't' });
    expect(needsMenuOpen(at('ghid'), true)).toBe(true);
    expect(needsMenuOpen(at('row-x'), true)).toBe(true);
    expect(needsMenuOpen(at('ghid'), false)).toBe(false);
    expect(needsMenuOpen(at('ins-maria'), true)).toBe(false);
  });
});
