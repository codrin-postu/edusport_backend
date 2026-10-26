import { describe, expect, it } from 'vitest';
import type { HistoryInput } from '../history';
import { historyTexts } from '../history-text';
import { REGISTRATION_EDIT_ERROR } from '../registration-edit';
import { STATUS_ERROR, updateRegistration, type RegistrationEditDeps } from '../registration-update';

const BASE = { documentId: 'r1', childName: 'Maria Pop', childBirthDate: '14 martie 2016', phone: '0722', status: 'Nou', season: '2026-2027', archived: false, childHeight: 130, lastSeason: null };

function deps(row: Record<string, unknown> | null = { ...BASE }) {
  const saved: Record<string, unknown>[] = [];
  const history: HistoryInput[] = [];
  const refreshed: string[] = [];
  const logs: string[] = [];
  const d: RegistrationEditDeps = {
    find: async () => row,
    save: async (_id, data) => {
      saved.push(data);
      return { ...row, ...data };
    },
    seasonIdForLabel: async (label) => (label === '2025-2026' ? 's25' : null),
    rebuild: async (_id, data) => ('childName' in data ? { ok: true, documents: ['acord'] } : null),
    record: async (e) => {
      history.push(e);
    },
    refreshMatch: async (id) => {
      refreshed.push(id);
    },
    log: (m) => logs.push(m),
  };
  return { d, saved, history, refreshed, logs };
}

describe('PUT /api/forms/inscrieri/:documentId (spec 3.2, 3.4)', () => {
  it('refuses "Confirmat": only "Confirmă înscrierea" sets it', async () => {
    expect(await updateRegistration(deps().d, 'r1', { status: 'Confirmat' }, 'ana')).toEqual({ ok: false, status: 400, error: STATUS_ERROR });
  });

  it('saves only changed fields, writes old -> new, rebuilds, then "Document refăcut", then refreshes the match', async () => {
    const t = deps();
    const result = await updateRegistration(t.d, 'r1', { childName: 'Maria Popa', phone: '0722', childBirthDate: '14.03.2016', foo: 1 }, 'ana');
    expect(result).toMatchObject({ ok: true, changed: ['childName', 'childBirthDate'], rebuild: { ok: true } });
    expect(t.saved).toEqual([{ childName: 'Maria Popa', childBirthDate: '14.03.2016', childBirthDateParsed: '2016-03-14' }]);
    expect(t.history.map((h) => [h.action, h.changes])).toEqual([
      ['updated', { fields: { childName: { from: 'Maria Pop', to: 'Maria Popa' }, childBirthDate: { from: '14 martie 2016', to: '14.03.2016' } } }],
      ['document-rebuilt', { documents: ['acord'] }],
    ]);
    expect(t.refreshed).toEqual(['r1']);
  });

  it('"Nicio modificare.": nothing saved, nothing written', async () => {
    const t = deps();
    expect(await updateRegistration(t.d, 'r1', { phone: '0722', archived: 'false' }, 'ana')).toMatchObject({ ok: true, changed: [] });
    expect([t.saved, t.history]).toEqual([[], []]);
  });

  it('points a new season text at its Sezon', async () => {
    const t = deps();
    await updateRegistration(t.d, 'r1', { season: ' 2025-2026 ' }, 'ana');
    expect(t.saved[0]).toEqual({ season: '2025-2026', seasonRef: 's25' });
  });

  it('edits the height and the last-season answer as the form stores them', async () => {
    const t = deps();
    await updateRegistration(t.d, 'r1', { childHeight: '132', lastSeason: 'Începători' }, 'ana');
    expect(t.saved[0]).toEqual({ childHeight: 132, lastSeason: 'Începători' });
    expect(await updateRegistration(deps().d, 'r1', { childHeight: '9' }, 'ana')).toEqual({ ok: false, status: 400, error: REGISTRATION_EDIT_ERROR });
    expect(await updateRegistration(deps().d, 'r1', { lastSeason: 'Poate' }, 'ana')).toEqual({ ok: false, status: 400, error: REGISTRATION_EDIT_ERROR });
  });

  it('is a 404 for an unknown registration', async () => {
    expect(await updateRegistration(deps(null).d, 'x', { phone: '1' }, 'ana')).toMatchObject({ ok: false, status: 404 });
  });

  it('keeps a saved edit when its history fails, and logs it', async () => {
    const t = deps();
    t.d.record = async () => {
      throw new Error('db');
    };
    expect(await updateRegistration(t.d, 'r1', { phone: '0733' }, 'ana')).toMatchObject({ ok: true, changed: ['phone'] });
    expect(t.logs[0]).toContain('db');
  });
});

describe('"De unde ați aflat" and "Calitatea față de sportiv" in Editează (plan 3-4 decision #6 B)', () => {
  it('keeps the source text only with "Altele"', async () => {
    const t = deps({ ...BASE, source: 'Facebook', sourceOther: null });
    await updateRegistration(t.d, 'r1', { source: 'Altele', sourceOther: ' Ziar ' }, 'ana');
    expect(t.saved[0]).toEqual({ source: 'Altele', sourceOther: 'Ziar' });
    const back = deps({ ...BASE, source: 'Altele', sourceOther: 'Ziar' });
    await updateRegistration(back.d, 'r1', { source: 'Instagram', sourceOther: 'Ziar' }, 'ana');
    expect(back.saved[0]).toEqual({ source: 'Instagram', sourceOther: null });
  });

  it('refuses a source the form does not offer', async () => {
    expect(await updateRegistration(deps().d, 'r1', { source: 'Radio' }, 'ana')).toEqual({ ok: false, status: 400, error: REGISTRATION_EDIT_ERROR });
  });

  it('a move to "Alta" with its text is one Istoric line', async () => {
    const t = deps({ ...BASE, relationship: 'parinte', relationshipOther: null });
    await updateRegistration(t.d, 'r1', { relationship: 'alta', relationshipOther: 'Bunic' }, 'ana');
    const [updated] = t.history;
    expect(historyTexts(updated.action, updated.changes, updated.subjectType)).toEqual(['Calitatea față de sportiv: "Părinte" → "Alta: Bunic"']);
  });

  it('writes a source change as one Istoric line', async () => {
    const t = deps({ ...BASE, source: 'Facebook', sourceOther: null });
    await updateRegistration(t.d, 'r1', { source: 'Altele', sourceOther: 'Ziar' }, 'ana');
    const [updated] = t.history;
    expect(historyTexts(updated.action, updated.changes, updated.subjectType)).toEqual(['De unde ați aflat: "Facebook" → "Altele: Ziar"']);
  });

  it('keeps an old answer outside today\'s options while it is sent back unchanged', async () => {
    const old = { ...BASE, source: 'Ziar local', lastSeason: 'Da' };
    const t = deps(old);
    expect(await updateRegistration(t.d, 'r1', { source: 'Ziar local', lastSeason: 'Da', phone: '0733' }, 'ana')).toMatchObject({ ok: true, changed: ['phone'] });
    expect(t.saved).toEqual([{ phone: '0733' }]);
    expect(await updateRegistration(deps(old).d, 'r1', { source: 'Radio' }, 'ana')).toEqual({ ok: false, status: 400, error: REGISTRATION_EDIT_ERROR });
    expect(await updateRegistration(deps(old).d, 'r1', { lastSeason: 'Poate' }, 'ana')).toEqual({ ok: false, status: 400, error: REGISTRATION_EDIT_ERROR });
  });

  it('keeps an "other" text sent alone only when the stored answer is "Altele" / "Alta"', async () => {
    const altele = deps({ ...BASE, source: 'Altele', sourceOther: 'Ziar', relationship: 'alta', relationshipOther: 'Bunica' });
    await updateRegistration(altele.d, 'r1', { sourceOther: 'Afiș', relationshipOther: 'Bunic' }, 'ana');
    expect(altele.saved).toEqual([{ sourceOther: 'Afiș', relationshipOther: 'Bunic' }]);
    const plain = deps({ ...BASE, source: 'Facebook', sourceOther: null, relationship: 'parinte', relationshipOther: null });
    expect(await updateRegistration(plain.d, 'r1', { sourceOther: 'Afiș', relationshipOther: 'Bunic' }, 'ana')).toMatchObject({ ok: true, changed: [] });
    expect(plain.saved).toEqual([]);
  });

  it('clears a stored "other" text when the effective answer is not "Altele" / "Alta"', async () => {
    const t = deps({ ...BASE, source: 'Facebook', sourceOther: 'Ziar', relationship: 'parinte', relationshipOther: 'Bunica' });
    await updateRegistration(t.d, 'r1', { sourceOther: 'Afiș', relationshipOther: 'Bunic' }, 'ana');
    expect(t.saved).toEqual([{ sourceOther: null, relationshipOther: null }]);
  });
});
