import { describe, expect, it } from 'vitest';
import { markFlow, markIntro, parseProgress } from '../progress';

const A = '2026-01-01T10:00:00.000Z';
const B = '2026-02-02T10:00:00.000Z';

describe('parseProgress', () => {
  it('turns anything malformed into empty', () => {
    expect(parseProgress(null)).toEqual({ introAt: null, flows: {} });
    expect(parseProgress({ flows: 'x' })).toEqual({ introAt: null, flows: {} });
    expect(parseProgress([1])).toEqual({ introAt: null, flows: {} });
  });
  it('keeps valid entries and drops unknown flows and bad dates', () => {
    expect(parseProgress({ introAt: A, flows: { anunt: B, nope: A, plata: 'x' } })).toEqual({ introAt: A, flows: { anunt: B } });
  });
});

describe('marking', () => {
  it('keeps the first intro date', () => {
    expect(markIntro(markIntro(parseProgress(null), A), B).introAt).toBe(A);
  });
  it('adds a flow and keeps its first date on replay', () => {
    const once = markFlow(parseProgress(null), 'anunt', A);
    expect(markFlow(once, 'anunt', B).flows).toEqual({ anunt: A });
  });
  it('replaying never removes other flows', () => {
    const p = markFlow(markFlow(parseProgress(null), 'plata', A), 'anunt', A);
    expect(markFlow(p, 'plata', B).flows).toEqual({ plata: A, anunt: A });
  });
});
