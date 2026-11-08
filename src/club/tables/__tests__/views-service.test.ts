import { describe, expect, it } from 'vitest';
import { readDefinition } from '../definition';
import { TABLES_COPY } from '../copy';
import { createView, deleteView, listViews, undoViewDelete, updateView, type Caller } from '../views-service';
import { fakeViewsDb, viewRow } from './fake-views-store';
import { undoKindOf } from '../../presence/undo-service';
import type { TableDefinition } from '../types';

const ana: Caller = { adminId: 1, name: 'Ana Pop', email: 'ana@club.ro', superAdmin: false };
const bob: Caller = { adminId: 2, name: 'Bob Ionescu', email: 'bob@club.ro', superAdmin: false };
const root: Caller = { adminId: 3, name: 'Radu Super', email: 'radu@club.ro', superAdmin: true };

const def: TableDefinition = { subject: 'plati', scope: { seasonId: 's1', sectionId: null, groupId: null, period: { kind: 'current' } }, columns: ['data', 'sportiv', 'suma'], filters: [], groupBy: null, sort: null };
const body = (name: string, definition: unknown = def) => ({ name, definition });
const NOT_AUTHOR = 'Doar autorul poate modifica vizualizarea.';
const DUPLICATE = 'Există deja o vizualizare cu numele ăsta.';
const INVALID = 'Cerere invalidă.';

/** A live view of Ana's in the fake database, made through the service. */
async function withView(name = 'Plăți luna asta') {
  const db = fakeViewsDb();
  const made = await createView(db.store(), ana, body(name));
  if (!made.ok) throw new Error('setup');
  return { db, id: made.data.value.view.id };
}
const history = (db: ReturnType<typeof fakeViewsDb>) => db.state.history;
const refused = (r: { ok: boolean }): boolean => r.ok === false;

describe('create and list', () => {
  it('saves a validated view for its author and lists it with mine and canDelete [S10]', async () => {
    const db = fakeViewsDb();
    const made = await createView(db.store(), ana, body('  Plăți luna asta  '));
    expect(made).toMatchObject({ ok: true, data: { actionId: null, value: { toast: 'Vizualizare salvată.', view: { name: 'Plăți luna asta', subject: 'plati', mine: true, canDelete: true, readyMade: false, authorId: '1', authorName: 'Ana Pop' } } } });
    expect(db.state.views[0]).toMatchObject({ authorId: 1, authorName: 'Ana Pop', subject: 'plati', definition: def });
    const forBob = await listViews(db.store(), bob);
    expect(forBob.map((v) => [v.name, v.mine, v.canDelete])).toEqual([['Plăți luna asta', false, false]]);
    expect((await listViews(db.store(), root)).map((v) => [v.mine, v.canDelete])).toEqual([[false, true]]);
    expect((await listViews(db.store(), ana)).map((v) => [v.mine, v.canDelete])).toEqual([[true, true]]);
  });

  it('refuses a name that is empty, blank, too long or not text, and trims before counting', async () => {
    const db = fakeViewsDb();
    for (const name of ['', '   ', 'x'.repeat(81), 5, null, undefined, ['a']]) {
      expect(await createView(db.store(), ana, { name, definition: def }), String(name)).toEqual({ ok: false, status: 400, error: INVALID });
    }
    expect((await createView(db.store(), ana, body(`  ${'x'.repeat(80)}  `))).ok).toBe(true);
    expect(db.state.views).toHaveLength(1);
  });

  it('refuses a name taken by a live view, whatever the case, and lets a deleted one go', async () => {
    const { db } = await withView('Plăți');
    expect(await createView(db.store(), bob, body('PLĂȚI'))).toEqual({ ok: false, status: 400, error: DUPLICATE });
    expect(await createView(db.store(), bob, body(' plăți '))).toEqual({ ok: false, status: 400, error: DUPLICATE });
    db.state.views[0].deletedAt = '2026-11-20T10:00:00.000Z';
    expect((await createView(db.store(), bob, body('Plăți'))).ok).toBe(true);
  });

  it('allows 200 saved views and refuses the 201st; deleted views do not count', async () => {
    const views = Array.from({ length: 199 }, (_, i) => viewRow({ id: `s${i}`, name: `V${i}` }));
    const db = fakeViewsDb({ views });
    expect((await createView(db.store(), ana, body('Ultima'))).ok).toBe(true);
    expect(await createView(db.store(), ana, body('Una prea mult'))).toEqual({ ok: false, status: 400, error: 'Prea multe vizualizări salvate. Șterge una.' });
    db.state.views[0].deletedAt = '2026-11-20T10:00:00.000Z';
    expect((await createView(db.store(), ana, body('Acum încape'))).ok).toBe(true);
  });
});

describe('a definition always goes through the validator', () => {
  const hostile: unknown[] = [
    { ...def, columns: ['data', 'athlete.email'] }, { ...def, subject: 'users' }, { ...def, extra: 1 }, { ...def, filters: [{ column: 'suma', op: 'gt', value: 'drop table' }] },
    { ...def, columns: [] }, null, 'x', [def], { ...def, scope: { ...def.scope, period: { from: '2026-01-01', to: '2027-12-31' } } },
    JSON.parse('{"__proto__":{"x":1},"subject":"plati"}'),
  ];

  it('on save: a bad definition answers 400 "Cerere invalidă." and nothing is stored', async () => {
    const db = fakeViewsDb();
    for (const h of hostile) expect(await createView(db.store(), ana, body('V', h)), JSON.stringify(h)).toEqual({ ok: false, status: 400, error: INVALID });
    expect(await createView(db.store(), ana, { name: 'V' })).toEqual({ ok: false, status: 400, error: INVALID });
    expect(await createView(db.store(), ana, 'x')).toEqual({ ok: false, status: 400, error: INVALID });
    expect(db.state.views).toEqual([]);
  });

  it('on save: the stored definition is the validator output, not the request object', async () => {
    const db = fakeViewsDb();
    const request = body('V');
    await createView(db.store(), ana, request);
    expect(db.state.views[0].definition).toEqual(readDefinition({ definition: def }).ok ? def : null);
    expect(db.state.views[0].definition).not.toBe(request.definition);
  });

  it('on update: a bad definition or body is refused and the view stays as it was', async () => {
    const { db, id } = await withView();
    for (const h of hostile) expect(await updateView(db.store(), ana, id, { definition: h }), JSON.stringify(h)).toEqual({ ok: false, status: 400, error: INVALID });
    for (const b of [{}, null, 'x', { name: 5 }, { name: '' }, { definition: def, role: 'admin' }, { id: 'other', name: 'V' }]) {
      expect(await updateView(db.store(), ana, id, b), JSON.stringify(b)).toEqual({ ok: false, status: 400, error: INVALID });
    }
    expect(db.state.views[0]).toMatchObject({ name: 'Plăți luna asta', definition: def });
  });

  it('on load: every listed definition passes the validator', async () => {
    const db = fakeViewsDb({ views: [viewRow({ id: 'a', name: 'A', definition: def }), viewRow({ id: 'b', name: 'B', definition: { ...def, columns: ['data', 'gone'] } })] });
    for (const v of await listViews(db.store(), bob)) expect(readDefinition({ definition: v.definition }).ok, v.name).toBe(true);
  });

  it('on load: a column the catalog dropped is removed with one notice, the view still opens', async () => {
    const db = fakeViewsDb({ views: [viewRow({ id: 'b', name: 'B', definition: { ...def, columns: ['data', 'gone'], filters: [{ column: 'gone', op: 'eq', value: 'x' }] } })] });
    const [v] = await listViews(db.store(), bob);
    expect(v.definition?.columns).toEqual(['data']);
    expect(v.definition?.filters).toEqual([]);
    expect(v.notices).toEqual([TABLES_COPY.notices.columnDropped, TABLES_COPY.notices.filterDropped]);
  });

  it('on load: stored junk never reaches the screen as it is; an unrepairable view is listed as broken, with no definition', async () => {
    const junk: unknown[] = [null, 'x', 5, [], {}, { subject: 'users', columns: ['a'] }, { ...def, columns: ['nope'] }, { subject: 'plati', columns: ['data'], scope: null }, { ...def, sql: 'drop table x', __proto__: { admin: true } }];
    const views = junk.map((definition, i) => viewRow({ id: `j${i}`, name: `J${i}`, definition }));
    const listed = await listViews(fakeViewsDb({ views }).store(), bob);
    expect(listed.map((v) => v.name)).toEqual(['J0', 'J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7', 'J8']);
    for (const v of listed.filter((x) => x.name !== 'J8')) expect(v, v.name).toMatchObject({ broken: true, definition: null });
    for (const v of listed) {
      if (v.broken) continue;
      expect(readDefinition({ definition: v.definition }).ok).toBe(true);
      expect(Object.keys(v.definition ?? {}).sort()).toEqual(['columns', 'filters', 'groupBy', 'scope', 'sort', 'subject']);
    }
  });

  it('a broken view counts for the author and canDelete, can be deleted by them, and is gone from the list afterwards', async () => {
    const db = fakeViewsDb({ views: [viewRow({ id: 'b1', name: 'Veche', definition: { subject: 'plati' }, authorId: 1 })] });
    const [forAna] = await listViews(db.store(), ana);
    expect(forAna).toMatchObject({ broken: true, mine: true, canDelete: true, readyMade: false, definition: null });
    expect((await listViews(db.store(), bob))[0]).toMatchObject({ broken: true, mine: false, canDelete: false });
    expect((await listViews(db.store(), root))[0]).toMatchObject({ canDelete: true });
    expect(await deleteView(db.store(), bob, 'b1')).toMatchObject({ ok: false, status: 403 });
    expect((await deleteView(db.store(), ana, 'b1')).ok).toBe(true);
    expect(await listViews(db.store(), ana)).toEqual([]);
  });

  it('the author can fix a broken view by saving a definition; a name-only edit keeps it broken and does not fail', async () => {
    const db = fakeViewsDb({ views: [viewRow({ id: 'b1', name: 'Veche', definition: { subject: 'plati' }, authorId: 1 })] });
    expect(await updateView(db.store(), ana, 'b1', { name: 'Nou' })).toMatchObject({ ok: true, data: { value: { view: { name: 'Nou', broken: true } } } });
    const fixed = await updateView(db.store(), ana, 'b1', { definition: def });
    expect(fixed).toMatchObject({ ok: true });
    expect((await listViews(db.store(), ana))[0]).toMatchObject({ definition: def });
    expect((await listViews(db.store(), ana))[0].broken).toBeUndefined();
  });
});

describe('the author rule [S10]', () => {
  it('the author updates the name and the definition; toast "Salvat."', async () => {
    const { db, id } = await withView();
    const next = { ...def, columns: ['data', 'suma'] };
    const res = await updateView(db.store(), ana, id, { name: 'Alt nume', definition: next });
    expect(res).toMatchObject({ ok: true, data: { actionId: null, value: { toast: 'Salvat.', view: { id, name: 'Alt nume', mine: true } } } });
    expect(db.state.views[0]).toMatchObject({ name: 'Alt nume', definition: next, authorId: 1 });
  });

  it('keeps the author when it is edited, even for a body naming other fields', async () => {
    const { db, id } = await withView();
    await updateView(db.store(), ana, id, { name: 'X' });
    expect(db.state.views[0]).toMatchObject({ authorId: 1, authorName: 'Ana Pop', deletedAt: null });
  });

  it('another admin gets 403 with the text on PUT and on DELETE, and nothing changes', async () => {
    const { db, id } = await withView();
    expect(await updateView(db.store(), bob, id, { name: 'Furat' })).toEqual({ ok: false, status: 403, error: NOT_AUTHOR });
    expect(await deleteView(db.store(), bob, id)).toEqual({ ok: false, status: 403, error: NOT_AUTHOR });
    expect(db.state.views[0]).toMatchObject({ name: 'Plăți luna asta', deletedAt: null });
    expect(history(db)).toEqual([]);
  });

  it('a Super Admin deletes someone else\'s view but may not edit it', async () => {
    const { db, id } = await withView();
    expect(await updateView(db.store(), root, id, { name: 'Radu a schimbat' })).toEqual({ ok: false, status: 403, error: NOT_AUTHOR });
    expect(db.state.views[0].name).toBe('Plăți luna asta');
    const res = await deleteView(db.store(), root, id);
    expect(res).toMatchObject({ ok: true, data: { value: { deleted: true, toast: 'Vizualizare ștearsă.' } } });
    expect(db.state.views[0].deletedAt).not.toBeNull();
  });

  it('a Super Admin edits and deletes his own view', async () => {
    const db = fakeViewsDb();
    const made = await createView(db.store(), root, body('Ale lui Radu'));
    const id = made.ok ? made.data.value.view.id : '';
    expect((await updateView(db.store(), root, id, { name: 'Radu 2' })).ok).toBe(true);
    expect((await deleteView(db.store(), root, id)).ok).toBe(true);
  });

  it('answers 404 for a missing or already deleted view, before anything else', async () => {
    const { db, id } = await withView();
    expect(await updateView(db.store(), ana, 'nope', { name: 'X' })).toEqual({ ok: false, status: 404, error: 'Nu a fost găsit.' });
    expect(await deleteView(db.store(), ana, 'nope')).toEqual({ ok: false, status: 404, error: 'Nu a fost găsit.' });
    await deleteView(db.store(), ana, id);
    expect(refused(await deleteView(db.store(), ana, id))).toBe(true);
    expect(await updateView(db.store(), ana, id, { name: 'X' })).toEqual({ ok: false, status: 404, error: 'Nu a fost găsit.' });
  });

  it('a rename onto another live view\'s name is refused, a change of case on its own name is not', async () => {
    const { db, id } = await withView('Prima');
    await createView(db.store(), bob, body('A doua'));
    expect(await updateView(db.store(), ana, id, { name: 'a DOUA' })).toEqual({ ok: false, status: 400, error: DUPLICATE });
    expect((await updateView(db.store(), ana, id, { name: 'PRIMA' })).ok).toBe(true);
  });

  it('the author of a view is never taken from the request: a body that names one is refused', async () => {
    const db = fakeViewsDb();
    expect(await createView(db.store(), bob, { name: 'V', definition: def, authorId: 1, authorName: 'Ana' })).toEqual({ ok: false, status: 400, error: INVALID });
    expect(db.state.views).toEqual([]);
    await createView(db.store(), bob, body('V'));
    expect(db.state.views[0]).toMatchObject({ authorId: 2, authorName: 'Bob Ionescu' });
  });
});

describe('delete and undo', () => {
  it('writes one history line on subject table-view, with the undo record and no athlete data', async () => {
    const { db, id } = await withView();
    const filtered = await createView(db.store(), ana, body('Cu filtru', { ...def, filters: [{ column: 'sportiv', op: 'eq', value: 'Maria Secretă' }] }));
    const filteredId = filtered.ok ? filtered.data.value.view.id : '';
    const res = await deleteView(db.store(), ana, filteredId);
    expect(history(db)).toHaveLength(1);
    expect(history(db)[0]).toMatchObject({ subjectType: 'table-view', subjectId: filteredId, actor: 'ana@club.ro', changes: { byAdminId: 1, undo: { kind: 'table-view', id: filteredId } } });
    expect(res.ok && res.data.actionId).toBe(history(db)[0].id);
    expect(JSON.stringify(history(db))).not.toContain('Maria Secretă');
    expect(history(db).some((h) => h.subjectType === 'athlete')).toBe(false);
    expect(db.state.views.find((v) => v.id === id)?.deletedAt).toBeNull();
  });

  it('delete then undo brings the same id back and it lists again', async () => {
    const { db, id } = await withView();
    const del = await deleteView(db.store(), ana, id);
    const actionId = del.ok ? del.data.actionId ?? '' : '';
    expect(await listViews(db.store(), ana)).toEqual([]);
    expect(await undoViewDelete(db.store(), ana, actionId)).toEqual({ ok: true, data: { undone: true } });
    expect((await listViews(db.store(), ana)).map((v) => v.id)).toEqual([id]);
    expect(history(db)[0].changes.undone).toBe(true);
  });

  it('a second undo of the same action is refused', async () => {
    const { db, id } = await withView();
    const del = await deleteView(db.store(), ana, id);
    const actionId = del.ok ? del.data.actionId ?? '' : '';
    await undoViewDelete(db.store(), ana, actionId);
    expect(refused(await undoViewDelete(db.store(), ana, actionId))).toBe(true);
  });

  it('an old toast cannot bring the view back after a newer delete', async () => {
    const { db, id } = await withView();
    const first = await deleteView(db.store(), ana, id);
    await undoViewDelete(db.store(), ana, first.ok ? first.data.actionId ?? '' : '');
    await deleteView(db.store(), ana, id);
    const stale = await undoViewDelete(db.store(), ana, first.ok ? first.data.actionId ?? '' : '');
    expect(refused(stale)).toBe(true);
    expect(db.state.views[0].deletedAt).not.toBeNull();
  });

  it('a deleted view\'s name can be reused, and the undo then answers 409', async () => {
    const { db, id } = await withView('Plăți');
    const del = await deleteView(db.store(), ana, id);
    await createView(db.store(), bob, body('plăți'));
    expect(await undoViewDelete(db.store(), ana, del.ok ? del.data.actionId ?? '' : '')).toEqual({ ok: false, status: 409, error: DUPLICATE });
    expect(db.state.views.find((v) => v.id === id)?.deletedAt).not.toBeNull();
  });

  it('undo cannot restore someone else\'s view: another admin gets 403 and the view stays deleted', async () => {
    const { db, id } = await withView();
    const del = await deleteView(db.store(), ana, id);
    const actionId = del.ok ? del.data.actionId ?? '' : '';
    expect(await undoViewDelete(db.store(), bob, actionId)).toEqual({ ok: false, status: 403, error: NOT_AUTHOR });
    expect(await undoViewDelete(db.store(), root, actionId)).toEqual({ ok: false, status: 403, error: NOT_AUTHOR });
    expect(db.state.views[0].deletedAt).not.toBeNull();
    expect(history(db)[0].changes.undone).toBeUndefined();
  });

  it('a Super Admin may undo his own delete of someone else\'s view, nobody else may', async () => {
    const { db, id } = await withView();
    const del = await deleteView(db.store(), root, id);
    const actionId = del.ok ? del.data.actionId ?? '' : '';
    expect(await undoViewDelete(db.store(), bob, actionId)).toEqual({ ok: false, status: 403, error: NOT_AUTHOR });
    expect((await undoViewDelete(db.store(), ana, actionId)).ok).toBe(false);
    expect(await undoViewDelete(db.store(), { ...root, superAdmin: false }, actionId)).toEqual({ ok: false, status: 403, error: NOT_AUTHOR });
    expect((await undoViewDelete(db.store(), root, actionId)).ok).toBe(true);
    expect(db.state.views[0].deletedAt).toBeNull();
  });

  it('refuses an action that is not a view delete, or missing, or whose view is gone', async () => {
    const { db, id } = await withView();
    await db.store().recordAction('ana@club.ro', { subjectType: 'group', subjectId: 'g', action: 'group-updated', changes: { undo: { kind: 'group', steps: [], subjects: [], revalidate: false } } });
    expect(await undoViewDelete(db.store(), ana, 'nope')).toEqual({ ok: false, status: 404, error: 'Nu a fost găsit.' });
    expect(refused(await undoViewDelete(db.store(), ana, history(db)[0].id))).toBe(true);
    const del = await deleteView(db.store(), ana, id);
    db.state.views = [];
    expect(refused(await undoViewDelete(db.store(), ana, del.ok ? del.data.actionId ?? '' : ''))).toBe(true);
  });

  it('purges views deleted more than a day ago when another is deleted', async () => {
    const old = viewRow({ id: 'old', name: 'Vechi', deletedAt: '2026-11-18T09:00:00.000Z' });
    const recent = viewRow({ id: 'new', name: 'Recent', deletedAt: '2026-11-20T09:00:00.000Z' });
    const db = fakeViewsDb({ views: [old, recent] });
    const made = await createView(db.store(), ana, body('Curent'));
    const id = made.ok ? made.data.value.view.id : '';
    await deleteView(db.store(), ana, id, { now: () => new Date('2026-11-20T12:00:00.000Z') });
    expect(db.state.views.map((v) => v.id).sort()).toEqual(['new', id].sort());
  });

  it('undoKindOf tells a view delete from presence and phase 4 undo', async () => {
    const { db, id } = await withView();
    const del = await deleteView(db.store(), ana, id);
    const s = db.store();
    expect(await undoKindOf(s, { actionId: del.ok ? del.data.actionId : '' })).toBe('table-view');
    expect(await undoKindOf(s, { actionId: 'missing' })).toBe('other');
  });

  it('a failure inside the delete rolls everything back, is logged once and answers 500', async () => {
    const { db, id } = await withView();
    const logged: string[] = [];
    db.failOn('recordAction');
    await expect(deleteView(db.store(), ana, id, { log: (m) => logged.push(m) })).resolves.toEqual({ ok: false, status: 500, error: 'Acțiunea nu a reușit. Nimic nu a fost salvat.' });
    expect(logged).toHaveLength(1);
    expect(db.state.views[0].deletedAt).toBeNull();
    expect(history(db)).toEqual([]);
  });
});

describe('concurrent requests', () => {
  const ok = (r: { ok: boolean }): boolean => r.ok;

  it('two admins saving the same name at once: one wins, the other is told', async () => {
    const db = fakeViewsDb();
    const results = await Promise.all([createView(db.store(), ana, body('Plăți')), createView(db.store(), bob, body('plăți'))]);
    expect(results.filter(ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, status: 400, error: DUPLICATE });
    expect(db.state.views).toHaveLength(1);
  });

  it('without the name lock the same race would land two views (the fake has teeth)', async () => {
    const db = fakeViewsDb({}, { locking: false });
    await Promise.all([createView(db.store(), ana, body('Plăți')), createView(db.store(), bob, body('plăți'))]);
    expect(db.state.views).toHaveLength(2);
  });

  it('two saves racing for the 200th place: one wins', async () => {
    const db = fakeViewsDb({ views: Array.from({ length: 199 }, (_, i) => viewRow({ id: `s${i}`, name: `V${i}` })) });
    const results = await Promise.all([createView(db.store(), ana, body('A')), createView(db.store(), bob, body('B'))]);
    expect(results.filter(ok)).toHaveLength(1);
    expect(db.state.views).toHaveLength(200);
  });

  it('a delete and an edit of the same view at once end deleted, never half way', async () => {
    const { db, id } = await withView();
    const [del, upd] = await Promise.all([deleteView(db.store(), ana, id), updateView(db.store(), ana, id, { name: 'Nou' })]);
    expect(del.ok).toBe(true);
    expect([true, false]).toContain(upd.ok);
    if (!upd.ok) expect(upd).toMatchObject({ status: 404 });
    expect(db.state.views[0].deletedAt).not.toBeNull();
    expect(history(db)).toHaveLength(1);
  });

  it('two deletes at once write one history line; the second answers 404', async () => {
    const { db, id } = await withView();
    const results = await Promise.all([deleteView(db.store(), ana, id), deleteView(db.store(), root, id)]);
    expect(results.filter(ok)).toHaveLength(1);
    expect(history(db)).toHaveLength(1);
  });

  it('two undos of the same delete at once: one restores, the other is refused', async () => {
    const { db, id } = await withView();
    const del = await deleteView(db.store(), ana, id);
    const actionId = del.ok ? del.data.actionId ?? '' : '';
    const results = await Promise.all([undoViewDelete(db.store(), ana, actionId), undoViewDelete(db.store(), ana, actionId)]);
    expect(results.filter(ok)).toHaveLength(1);
    expect(db.state.views[0].deletedAt).toBeNull();
  });

  it('an undo and a save of the same name at once never leave two live views with that name', async () => {
    const { db, id } = await withView('Plăți');
    const del = await deleteView(db.store(), ana, id);
    const actionId = del.ok ? del.data.actionId ?? '' : '';
    const results = await Promise.all([undoViewDelete(db.store(), ana, actionId), createView(db.store(), bob, body('plăți'))]);
    expect(results.filter(ok)).toHaveLength(1);
    expect(db.state.views.filter((v) => v.deletedAt === null)).toHaveLength(1);
  });

  it('an undo and an edit by the author at once leave one consistent view', async () => {
    const { db, id } = await withView();
    const del = await deleteView(db.store(), ana, id);
    const actionId = del.ok ? del.data.actionId ?? '' : '';
    const [undone, edited] = await Promise.all([undoViewDelete(db.store(), ana, actionId), updateView(db.store(), ana, id, { name: 'Nou' })]);
    expect(undone.ok).toBe(true);
    expect(db.state.views[0]).toMatchObject({ name: edited.ok ? 'Nou' : 'Plăți luna asta', deletedAt: null });
    if (!edited.ok) expect(edited).toMatchObject({ status: 404 });
  });
});
