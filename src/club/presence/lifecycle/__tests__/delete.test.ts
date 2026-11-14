import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { AdminCtx } from '../../../admin-http';
import { deleteAthlete } from '../../../athletes/delete';
import { athleteRow, fakeClubStore } from '../../../athletes/__tests__/fake-store';
import { LIFECYCLE_DELETE, deleteBlockedText } from '../../copy/lifecycle';
import { attendanceRow, fakePresenceStore, lessonRow, paymentRow, sessionRow, subscriptionRow, type FakePresenceSeed } from '../../__tests__/fake-store';
import { respondDelete } from '../http';

const SRC = join(__dirname, '../../../..');
const source = (p: string) => readFileSync(join(SRC, p), 'utf8');

function setup(over: FakePresenceSeed) {
  const club = fakeClubStore({
    athletes: [athleteRow({ id: 'a1', name: 'Ana Ionescu' }), athleteRow({ id: 'a2', name: 'Ion Ilie' })],
    memberships: [{ id: 'm1', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: null }],
  });
  const pres = fakePresenceStore({
    sessions: [sessionRow({ id: 's1' })],
    attendances: [attendanceRow({ id: 't1', sessionId: 's1', athleteId: 'a1', uniqueKey: 's1|a1' }), attendanceRow({ id: 't2', sessionId: 's1', athleteId: 'a2', uniqueKey: 's1|a2' })],
    lessons: [lessonRow({ id: 'l1', athleteId: 'a1' })],
    ...over,
  });
  const ctx = { store: club.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 27 }, log: vi.fn() };
  return { club, pres, presence: pres.store, ctx };
}

describe('delete refusal and presence rows (4.21, C37, 5.14)', () => {
  it('refusal sentence drops a part with 0, with number forms (5.14, C66)', () => {
    expect(deleteBlockedText(2, 1)).toBe('Sportivul are 2 plăți și 1 abonament. Ștergerea este blocată cât timp există plăți sau abonamente.');
    expect(deleteBlockedText(0, 1)).toBe('Sportivul are 1 abonament. Ștergerea este blocată cât timp există plăți sau abonamente.');
    expect(deleteBlockedText(1, 0)).toBe('Sportivul are 1 plată. Ștergerea este blocată cât timp există plăți sau abonamente.');
    expect(deleteBlockedText(20, 3)).toBe('Sportivul are 20 de plăți și 3 abonamente. Ștergerea este blocată cât timp există plăți sau abonamente.');
    expect(LIFECYCLE_DELETE.title('Ana Ionescu')).toBe('Șterge Ana Ionescu');
  });

  it('is refused while a payment exists, a cancelled one too; nothing is written (4.21, C37)', async () => {
    const f = setup({ payments: [paymentRow({ id: 'p1', athleteId: 'a1', cancelled: true })] });
    expect(await deleteAthlete(f.ctx, 'a1', f.presence)).toEqual({ ok: true, data: { deleted: false, blocked: { payments: 1, subscriptions: 0 } } });
    expect(f.club.state.athletes.map((a) => a.id)).toContain('a1');
    expect(f.club.state.memberships).toHaveLength(1);
    expect(f.pres.state.attendances).toHaveLength(2);
    expect(f.pres.state.lessons).toHaveLength(1);
    expect(f.club.state.history).toEqual([]);
  });

  it('is refused while only a cancelled abonament exists', async () => {
    const f = setup({ subscriptions: [subscriptionRow({ id: 'sub1', athleteId: 'a1', cancelled: true })] });
    expect(await deleteAthlete(f.ctx, 'a1', f.presence)).toEqual({ ok: true, data: { deleted: false, blocked: { payments: 0, subscriptions: 1 } } });
  });

  it('otherwise removes attendance rows and lessons, keeps the session (4.21)', async () => {
    const f = setup({ lessonCancels: [{ athleteId: 'a1', date: '2026-11-21', startTime: '17:00', durationMin: 45 }, { athleteId: 'a2', date: '2026-11-21', startTime: '17:00', durationMin: 45 }] });
    expect(await deleteAthlete(f.ctx, 'a1', f.presence)).toEqual({ ok: true, data: { deleted: true, documentId: 'a1' } });
    expect(f.pres.state.attendances.map((a) => a.athleteId)).toEqual(['a2']);
    expect(f.pres.state.lessons).toEqual([]);
    expect(f.pres.state.lessonCancels.map((x) => x.athleteId)).toEqual(['a2']);
    expect(f.pres.state.sessions).toHaveLength(1);
    expect(f.club.state.athletes.map((a) => a.id)).toEqual(['a2']);
  });

  it('only the deleted athlete rows go; another athlete payments never block it', async () => {
    const f = setup({ payments: [paymentRow({ id: 'p9', athleteId: 'a2' })] });
    expect(await deleteAthlete(f.ctx, 'a1', f.presence)).toMatchObject({ ok: true, data: { deleted: true } });
    expect(f.pres.state.payments).toHaveLength(1);
  });

  it('reads payments only after holding the athlete lock (7.1)', async () => {
    const f = setup({});
    const seen: boolean[] = [];
    const read = f.presence.payments.bind(f.presence);
    f.presence.payments = async (where) => {
      seen.push(f.club.state.locks.includes('athlete:a1'));
      return read(where);
    };
    await deleteAthlete(f.ctx, 'a1', f.presence);
    expect(seen).toEqual([true]);
  });

  it('rolls both stores back when a later step fails', async () => {
    const f = setup({});
    f.club.failOn('deleteAthlete');
    expect(await deleteAthlete(f.ctx, 'a1', f.presence)).toEqual({ ok: false, status: 500, error: 'Acțiunea nu a reușit. Nimic nu a fost salvat.' });
    expect(f.pres.state.attendances).toHaveLength(2);
    expect(f.pres.state.lessons).toHaveLength(1);
  });

  it('answers 409 with the counts and the sentence; a delete as before (6, 5.14)', () => {
    const ctx = { status: 200, body: null } as AdminCtx;
    respondDelete(ctx, { ok: true, data: { deleted: false, blocked: { payments: 2, subscriptions: 1 } } });
    expect([ctx.status, ctx.body]).toEqual([409, { data: { payments: 2, subscriptions: 1 }, error: { status: 409, name: 'ClubAdminError', message: deleteBlockedText(2, 1) } }]);
    const ok = { status: 200, body: null } as AdminCtx;
    respondDelete(ok, { ok: true, data: { deleted: true, documentId: 'a1' } });
    expect(ok.body).toEqual({ data: { documentId: 'a1' } });
  });

  it('the remove handler passes a presence store and answers through respondDelete', () => {
    expect(source('api/club/controllers/athletes.ts')).toMatch(/respondDelete\(ctx, await deleteAthlete\(await serviceContext\(strapi, ctx\), ctx\.params\.documentId \?\? '', strapiPresenceStore\(strapi\)\)\)/);
  });
});
