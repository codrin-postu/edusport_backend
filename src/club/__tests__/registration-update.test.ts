import { describe, expect, it } from 'vitest';
import type { HistoryInput } from '../history';
import { historyTexts } from '../history-text';
import { ADMIN_ERRORS } from '../athletes/errors';
import { REGISTRATION_EDIT_ERROR } from '../registration-edit';
import { LINKED_STATUS_ERROR, STATUS_ERROR, updateRegistration, type RegistrationEditDeps } from '../registration-update';

const BASE = { documentId: 'r1', childName: 'Maria Pop', childBirthDate: '14 martie 2016', phone: '0722', status: 'Nou', season: '2026-2027', archived: false, childHeight: 130, lastSeason: null };

function deps(row: Record<string, unknown> | null = { ...BASE }) {
  const saved: Record<string, unknown>[] = [];
  const history: HistoryInput[] = [];
  const refreshed: string[] = [];
  const logs: string[] = [];
  const d: RegistrationEditDeps = {
    find: async () => row,
    exclusive: (_id, work) => work(),
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

  it('a save that throws answers 500 with the shared "nothing saved" copy and logs once (final review I2)', async () => {
    const t = deps();
    t.d.save = async () => {
      throw new Error('db');
    };
    expect(await updateRegistration(t.d, 'r1', { phone: '0733' }, 'ana')).toEqual({ ok: false, status: 500, error: ADMIN_ERRORS.failed });
    expect(t.logs).toEqual(['[inscrieri] saving r1 failed: db']);
    expect(t.history).toEqual([]);
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

describe('a registration with an athlete linked keeps "Confirmat" (only "Anulează confirmarea" leaves it)', () => {
  const LINKED = { ...BASE, status: 'Confirmat', athlete: { documentId: 'a1' } };

  it('refuses a status change with 409, saves nothing', async () => {
    const t = deps({ ...LINKED });
    expect(await updateRegistration(t.d, 'r1', { status: 'Contactat' }, 'ana')).toEqual({ ok: false, status: 409, error: LINKED_STATUS_ERROR });
    expect([t.saved, t.history]).toEqual([[], []]);
  });

  it('still saves its other fields, and "Confirmat" sent back unchanged', async () => {
    const t = deps({ ...LINKED });
    expect(await updateRegistration(t.d, 'r1', { status: 'Confirmat', phone: '0733' }, 'ana')).toMatchObject({ ok: true, changed: ['phone'] });
  });

  it('sees a confirmation that landed first, because the read and the save hold the row', async () => {
    const row: Record<string, unknown> = { ...BASE };
    const t = deps(row);
    let holding = false;
    t.d.exclusive = async (_id, work) => {
      Object.assign(row, { status: 'Confirmat', athlete: { documentId: 'a1' } });
      holding = true;
      const result = await work();
      holding = false;
      return result;
    };
    const save = t.d.save;
    t.d.save = async (id, data) => {
      expect(holding).toBe(true);
      return save(id, data);
    };
    expect(await updateRegistration(t.d, 'r1', { status: 'Contactat' }, 'ana')).toEqual({ ok: false, status: 409, error: LINKED_STATUS_ERROR });
    expect(t.saved).toEqual([]);
    expect(await updateRegistration(t.d, 'r1', { phone: '0733' }, 'ana')).toMatchObject({ ok: true, changed: ['phone'] });
  });
});

describe('a registration linked to an anonymized athlete (fix round 1, critical)', () => {
  const ANON_LINKED = { ...BASE, athlete: { documentId: 'a9', status: 'anonimizat' } };

  it('refuses childName / phone edits with 409 stale, saves nothing', async () => {
    const t = deps({ ...ANON_LINKED });
    expect(await updateRegistration(t.d, 'r1', { childName: 'Alt Nume' }, 'ana')).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
    expect(await updateRegistration(t.d, 'r1', { phone: '0733' }, 'ana')).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
    expect([t.saved, t.history]).toEqual([[], []]);
  });

  it('still saves a registration of a normal (non-anonymized) athlete', async () => {
    const t = deps({ ...BASE, athlete: { documentId: 'a1', status: 'activ' } });
    expect(await updateRegistration(t.d, 'r1', { phone: '0733' }, 'ana')).toMatchObject({ ok: true, changed: ['phone'] });
  });
});

describe('the answer and the "Alta" text', () => {
  it('a null "Alta" text clears it', async () => {
    const t = deps({ ...BASE, relationship: 'alta', relationshipOther: 'Bunica' });
    expect(await updateRegistration(t.d, 'r1', { relationship: 'parinte', relationshipOther: null }, 'ana')).toMatchObject({ ok: true });
    expect(t.saved).toEqual([{ relationship: 'parinte', relationshipOther: null }]);
  });

  it('answers with the match refreshed after a name edit', async () => {
    const row: Record<string, unknown> = { ...BASE, matchLevel: null };
    const t = deps(row);
    t.d.save = async (_id, data) => {
      Object.assign(row, data);
      return { ...row };
    };
    t.d.refreshMatch = async () => {
      row.matchLevel = 'sigur';
    };
    expect(await updateRegistration(t.d, 'r1', { childName: 'Maria Popa' }, 'ana')).toMatchObject({ ok: true, data: { childName: 'Maria Popa', matchLevel: 'sigur' } });
  });
});
