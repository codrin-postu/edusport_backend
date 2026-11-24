import { describe, expect, it } from 'vitest';
import { changeFeatures, type FeaturePort } from '../change';
import type { Features, Installed } from '../features';

const ALL_ON: Features = { prezenta: true, abonamente: true, portalAntrenori: true, portalParinti: true, parcurs: true };

function fakePort(saved: Features, installed: Installed = { portalAntrenori: true, portalParinti: true }) {
  const calls = { saved: [] as Features[], cancelled: [] as string[][], history: [] as unknown[], order: [] as string[] };
  const port: FeaturePort = {
    saved: async () => saved,
    save: async (f) => { calls.saved.push(f); calls.order.push('save'); },
    cancelJobs: async (kinds) => { calls.cancelled.push(kinds); calls.order.push('cancel'); return 1; },
    history: async (e) => { calls.history.push(e); calls.order.push('history'); },
    installed,
  };
  return { port, calls };
}

describe('changeFeatures', () => {
  it('prezenta off turns abonamente off too, cancels payment jobs, writes one history entry', async () => {
    const { port, calls } = fakePort(ALL_ON);
    const result = await changeFeatures(port, { key: 'prezenta', on: false, actor: 'a@b.ro' });
    expect(result).toMatchObject({ ok: true, alsoOff: ['abonamente'] });
    expect(calls.saved).toEqual([{ ...ALL_ON, prezenta: false, abonamente: false }]);
    expect(calls.cancelled).toEqual([['payment']]);
    expect(calls.history).toEqual([{ subjectType: 'features', subjectId: 'club', action: 'featuresChanged', changes: { key: 'prezenta', on: false, alsoOff: ['abonamente'] }, actor: 'a@b.ro' }]);
    expect(calls.order).toEqual(['save', 'cancel', 'history']);
  });

  it('a portal off cancels its own job kind', async () => {
    const { port, calls } = fakePort(ALL_ON);
    await changeFeatures(port, { key: 'portalAntrenori', on: false, actor: 'a' });
    expect(calls.cancelled).toEqual([['portal-invite']]);
  });

  it('a feature without jobs cancels nothing', async () => {
    const { port, calls } = fakePort(ALL_ON);
    await changeFeatures(port, { key: 'parcurs', on: false, actor: 'a' });
    expect(calls.cancelled).toEqual([]);
    expect(calls.history).toHaveLength(1);
  });

  it('switching on cancels nothing', async () => {
    const { port, calls } = fakePort({ ...ALL_ON, parcurs: false, portalParinti: false });
    await changeFeatures(port, { key: 'portalParinti', on: true, actor: 'a' });
    expect(calls.cancelled).toEqual([]);
    expect(calls.saved).toHaveLength(1);
  });

  it('needsPrezenta and notInstalled save, cancel and record nothing', async () => {
    const a = fakePort({ ...ALL_ON, prezenta: false, abonamente: false });
    expect(await changeFeatures(a.port, { key: 'abonamente', on: true, actor: 'a' })).toEqual({ ok: false, code: 'needsPrezenta' });
    const b = fakePort({ ...ALL_ON, portalParinti: false }, { portalAntrenori: true, portalParinti: false });
    expect(await changeFeatures(b.port, { key: 'portalParinti', on: true, actor: 'a' })).toEqual({ ok: false, code: 'notInstalled' });
    for (const { calls } of [a, b]) expect(calls.order).toEqual([]);
  });
});
