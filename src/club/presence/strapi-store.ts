import { createId } from '@paralleldrive/cuid2';
import type { Core } from '@strapi/strapi';
import type { Knex } from 'knex';
import { linkId, raws, str, strapiClubStore, text, transactionScope } from '../athletes/strapi-store';
import type { Raw, Scope } from '../athletes/strapi-store';
import type { AcsState } from '../acs';
import { hhmm } from '../groups/dates';
import type { RepeatFreq } from '../groups/series';
import type { DayKey, WeekOfMonth } from '../groups/types';
import { calendarRows } from '../groups/occurrences';
import { deleted, found, strapiGroupStore } from '../groups/strapi-store';
import { isRecord } from '../narrow';
import type { Audience, PriceItemKind } from '../price-item';
import type { PresenceStore } from './store';
import { UniqueKeyError } from './store';
import type {
  AttendanceRow, Billing, Charge, LessonRow, LessonSeriesRow, PaymentMethod, PaymentPurpose, PaymentRow, PresenceType, PriceItemRow, PriceListRecord, SessionRow, SubscriptionRow,
} from './types';

const SESSION = 'api::session.session' as const;
const ATTENDANCE = 'api::attendance.attendance' as const;
const LESSON = 'api::individual-lesson.individual-lesson' as const;
const SERIES = 'api::lesson-series.lesson-series' as const;
const CANCEL = 'api::lesson-cancellation.lesson-cancellation' as const;
const SUBSCRIPTION = 'api::subscription.subscription' as const;
const PAYMENT = 'api::payment.payment' as const;
const PRICE_LIST = 'api::price-list.price-list' as const;
const SETTINGS = 'api::site-settings.site-settings' as const;
const JOB = 'api::email-job.email-job' as const;
const COUNTER_TABLE = 'club_counters';
const MAX = 100000;
const PG_UNIQUE = '23505';

const among = <T extends string>(values: readonly T[], v: unknown, fallback: T): T => values.find((x) => x === v) ?? fallback;
const BILLINGS: readonly Billing[] = ['slot', 'fara_abonament', 'club', 'inclus', 'fara_pret'];
const ITEM_KINDS: readonly PriceItemKind[] = ['subscription', 'session', 'individual', 'uscat'];
const METHODS: readonly PaymentMethod[] = ['numerar', 'card', 'transfer'];
const PURPOSES: readonly PaymentPurpose[] = ['abonament', 'cotizatie', 'club_luna', 'lectie', 'altceva'];
const ACS_STATES: readonly AcsState[] = ['da', 'nu', 'in_asteptare'];
const AUDIENCES: readonly Audience[] = ['member', 'nonMember'];
const TYPES: readonly PresenceType[] = ['grup', 'uscat'];

/** Decimals come back as text from Postgres. */
const decimal = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const amountOf = (v: unknown): number => decimal(v) ?? 0;
const audience = (v: unknown): Audience | null => AUDIENCES.find((a) => a === v) ?? null;
const ids = (v: unknown): string[] => raws(v).map((r) => text(r.documentId));
const stamp = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : str(v));

const toCharge = (c: Raw): Charge => ({ type: among(TYPES, c.type, 'grup'), itemName: text(c.itemName), price: decimal(c.price), included: c.included === true });

export const toSessionRow = (r: Raw): SessionRow => ({
  id: text(r.documentId), groupId: linkId(r.group) ?? '', seasonId: linkId(r.season) ?? '', date: text(r.date), startTime: hhmm(str(r.startTime)) ?? '',
  durationMin: Number(r.durationMin ?? 0), source: r.source === 'added' ? 'added' : 'schedule', eventId: linkId(r.event), occurrenceKey: str(r.occurrenceKey),
  outsideSchedule: r.outsideSchedule === true, coachIds: ids(r.coaches), savedBy: text(r.savedBy), savedAt: stamp(r.savedAt) ?? '', firstSavedAt: stamp(r.firstSavedAt) ?? '',
});

export function toAttendanceRow(r: Raw): AttendanceRow {
  const session = isRecord(r.session) ? r.session : {};
  return {
    id: text(r.documentId), sessionId: linkId(r.session) ?? '', athleteId: linkId(r.athlete) ?? '', uniqueKey: text(r.uniqueKey), grup: r.grup === true,
    uscat: r.uscat === true, visitor: r.visitor === true, subscriptionId: linkId(r.subscription), billing: among(BILLINGS, r.billing, 'fara_pret'),
    charges: raws(r.charges).map(toCharge), amount: amountOf(r.amount), audience: audience(r.audience),
    sessionDate: text(session.date), groupId: linkId(session.group) ?? '',
  };
}

const withStartTime = (r: Raw): AttendanceRow & { startTime: string } => ({
  ...toAttendanceRow(r), startTime: hhmm(str((isRecord(r.session) ? r.session : {}).startTime)) ?? '',
});

export const toLessonRow = (r: Raw): LessonRow => ({
  id: text(r.documentId), athleteId: linkId(r.athlete) ?? '', date: text(r.date), startTime: hhmm(str(r.startTime)) ?? '', durationMin: Number(r.durationMin ?? 0),
  coachIds: ids(r.coaches), state: r.state === 'saved' ? 'saved' : 'planned', present: typeof r.present === 'boolean' ? r.present : null, priceListId: linkId(r.priceList),
  itemName: str(r.itemName), price: decimal(r.price), audience: audience(r.audience), amount: amountOf(r.amount), createdByName: text(r.createdByName), recordedAt: stamp(r.recordedAt) ?? '',
  savedBy: str(r.savedBy), savedAt: stamp(r.savedAt), seriesId: linkId(r.series),
  movedFromDate: str(r.movedFromDate), movedFromTime: hhmm(str(r.movedFromTime)),
});

const FREQS: readonly RepeatFreq[] = ['weekly', 'biweekly', 'monthly'];
const WEEKS: readonly WeekOfMonth[] = ['first', 'second', 'third', 'fourth', 'last'];
const DAYS: readonly DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const toLessonSeriesRow = (r: Raw): LessonSeriesRow => ({
  id: text(r.documentId), athleteId: linkId(r.athlete) ?? '', coachIds: ids(r.coaches), freq: among(FREQS, r.freq, 'weekly'),
  days: (Array.isArray(r.days) ? r.days : []).flatMap((d) => DAYS.find((x) => x === d) ?? []), weekOfMonth: WEEKS.find((w) => w === r.weekOfMonth) ?? null,
  startTime: hhmm(str(r.startTime)) ?? '', durationMin: Number(r.durationMin ?? 0), from: text(r.from), to: text(r.to), createdByName: text(r.createdByName),
});

export const toSubscriptionRow = (r: Raw): SubscriptionRow => ({
  id: text(r.documentId), athleteId: linkId(r.athlete) ?? '', seasonId: linkId(r.season) ?? '', priceListId: linkId(r.priceList) ?? '', validIn: ids(r.validIn),
  itemName: text(r.itemName), price: decimal(r.price), audience: audience(r.audience) ?? 'member', slots: Number(r.slots ?? 0), startsOn: text(r.startsOn),
  validUntil: text(r.validUntil), extendedWeeks: Number(r.extendedWeeks ?? 0), cancelled: r.cancelled === true, cancelledAt: stamp(r.cancelledAt), cancelledBy: str(r.cancelledBy),
  purchasedAt: stamp(r.purchasedAt) ?? '', recordedBy: text(r.recordedBy), code: str(r.code),
});

export const toPaymentRow = (r: Raw): PaymentRow => ({
  id: text(r.documentId), athleteId: linkId(r.athlete) ?? '', amount: amountOf(r.amount), method: among(METHODS, r.method, 'numerar'), paidOn: text(r.paidOn),
  purpose: among(PURPOSES, r.purpose, 'altceva'), subscriptionId: linkId(r.subscription), lessonId: linkId(r.lesson), clubMonth: str(r.clubMonth),
  seasonId: linkId(r.season) ?? '', collectedAtRink: r.collectedAtRink === true, note: str(r.note), sendEmail: r.sendEmail === true, emailJobId: linkId(r.emailJob),
  acsBefore: ACS_STATES.find((s) => s === r.acsBefore) ?? null, recordedBy: text(r.recordedBy), recordedAt: stamp(r.recordedAt) ?? '', cancelled: r.cancelled === true,
  cancelledAt: stamp(r.cancelledAt), cancelledBy: str(r.cancelledBy), receiptNo: str(r.receiptNo),
});

const toPriceItem = (i: Raw): PriceItemRow => ({
  name: text(i.name), kind: among(ITEM_KINDS, i.kind, 'session'), sessions: i.sessions === null || i.sessions === undefined ? null : Number(i.sessions),
  memberPrice: decimal(i.memberPrice), nonMemberPrice: decimal(i.nonMemberPrice), included: i.included === true,
});

export const toPriceListRecord = (r: Raw): PriceListRecord => ({ id: text(r.documentId), name: text(r.name), sectionId: linkId(r.section), items: raws(r.items).map(toPriceItem) });

/** A duplicate key, as Postgres reports it (`23505`, on the error or its cause) or as the document service validates it. */
export function asUniqueKeyError(err: unknown): UniqueKeyError | null {
  if (!isRecord(err)) return null;
  const code = err.code ?? (isRecord(err.cause) ? err.cause.code : undefined);
  const validation = err.name === 'ValidationError' && typeof err.message === 'string' && err.message.includes('must be unique');
  return code === PG_UNIQUE || validation ? new UniqueKeyError(text(err.message)) : null;
}

const RELATIONS: Record<string, string> = {
  groupId: 'group', seasonId: 'season', eventId: 'event', coachIds: 'coaches', sessionId: 'session', athleteId: 'athlete', subscriptionId: 'subscription',
  priceListId: 'priceList', lessonId: 'lesson', emailJobId: 'emailJob', seriesId: 'series',
};
/** Document service data: set fields only, relations by documentId. */
const dataOf = (d: object): never =>
  Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined).map(([k, v]) => [RELATIONS[k] ?? k, v])) as never;
const rethrown = async <T>(work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (err) {
    throw asUniqueKeyError(err) ?? err;
  }
};

type Keys<K extends keyof PresenceStore> = Pick<PresenceStore, K>;
type Where = Record<string, unknown>;
const eq = (key: string, id: string | undefined): Where => (id ? { [key]: { documentId: id } } : {});
/** Only the bounds that are set: Postgres rejects an undefined bound as an InvalidDateFormat. */
const span = (w: { from?: string; to?: string }): Where => ({ ...(w.from ? { $gte: w.from } : {}), ...(w.to ? { $lte: w.to } : {}) });
const dated = (key: string, w: { from?: string; to?: string }): Where => (w.from || w.to ? { [key]: span(w) } : {});
const docIds = (list: string[] | undefined): Where => (list ? { documentId: { $in: list } } : {});

function lookups(strapi: Core.Strapi): Keys<'priceListRecords' | 'acsRows' | 'setAcs' | 'calendarWindow' | 'attendanceStartDate'> {
  const club = strapiClubStore(strapi);
  const acsRows: PresenceStore['acsRows'] = async (w) => (await club.acsRows(w.athleteId)).filter((r) => !w.seasonId || r.seasonId === w.seasonId);
  return {
    priceListRecords: async () => raws(await strapi.db.query(PRICE_LIST).findMany({ populate: ['section', 'items'], orderBy: { id: 'asc' }, limit: 1000 })).map(toPriceListRecord),
    acsRows,
    setAcs: async (athleteId, seasonId, state) => {
      const [row] = await acsRows({ athleteId, seasonId });
      if (state === null) {
        if (row) await club.deleteAcs(row.id);
      } else if (row) await club.updateAcs(row.id, { state });
      else await club.createAcs({ athleteId, seasonId, state });
    },
    calendarWindow: () => calendarRows(strapi),
    attendanceStartDate: async () => str(((await strapi.documents(SETTINGS).findFirst({})) as Raw | null)?.attendanceStartDate),
  };
}

function sessionRows(strapi: Core.Strapi): Keys<'sessions' | 'session' | 'sessionByKey' | 'createSession' | 'updateSession'> {
  const query = (where: Where) => strapi.db.query(SESSION).findMany({ where, populate: ['group', 'season', 'event', 'coaches'], orderBy: { id: 'asc' }, limit: MAX });
  const one = async (where: Where) => {
    const [row] = raws(await query(where));
    return row ? toSessionRow(row) : null;
  };
  return {
    sessions: async (w = {}) => raws(await query({ ...docIds(w.ids), ...eq('group', w.groupId), ...dated('date', w) })).map(toSessionRow),
    session: (id) => one({ documentId: id }),
    sessionByKey: (key) => one({ occurrenceKey: key }),
    createSession: (d) => rethrown(async () => (await strapi.documents(SESSION).create({ data: dataOf(d) })).documentId),
    updateSession: async (id, d) => {
      found(await strapi.documents(SESSION).update({ documentId: id, data: dataOf(d) }), 'updateSession');
    },
  };
}

/** The athlete's history pages: one count and one limited query each; the order joins the session through the query builder, ties after date and start time go by documentId. */
function historyPages(strapi: Core.Strapi): Keys<'athleteAttendancePage' | 'athleteLessonPage'> {
  return {
    athleteAttendancePage: async (athleteId, from, to, take) => {
      const where = { ...eq('athlete', athleteId), session: { date: span({ from, to }) } };
      const rows = await strapi.db.query(ATTENDANCE).findMany({
        where, populate: { session: { populate: ['group'] }, athlete: true, subscription: true },
        orderBy: [{ session: { date: 'desc' } }, { session: { startTime: 'desc' } }, { documentId: 'desc' }], limit: take,
      });
      return { total: await strapi.db.query(ATTENDANCE).count({ where }), rows: raws(rows).map(withStartTime) };
    },
    athleteLessonPage: async (athleteId, from, to, take) => {
      const where = { ...eq('athlete', athleteId), present: true, date: span({ from, to }) };
      const rows = await strapi.db.query(LESSON).findMany({
        where, populate: ['athlete', 'coaches', 'priceList', 'series'], orderBy: [{ date: 'desc' }, { startTime: 'desc' }, { documentId: 'desc' }], limit: take,
      });
      return { total: await strapi.db.query(LESSON).count({ where }), rows: raws(rows).map(toLessonRow) };
    },
  };
}

function attendanceRows(strapi: Core.Strapi): Keys<'attendances' | 'createAttendance' | 'updateAttendance' | 'deleteAttendance'> {
  return {
    attendances: async (w = {}) => {
      const session = { ...dated('date', w), ...(w.sessionIds ? { documentId: { $in: w.sessionIds } } : {}) };
      const where = {
        ...docIds(w.ids), ...eq('athlete', w.athleteId), ...(w.billing ? { billing: { $in: w.billing } } : {}),
        ...(w.subscriptionIds ? { subscription: { documentId: { $in: w.subscriptionIds } } } : {}), ...(Object.keys(session).length ? { session } : {}),
      };
      return raws(await strapi.db.query(ATTENDANCE).findMany({ where, populate: { session: { populate: ['group'] }, athlete: true, subscription: true }, orderBy: { id: 'asc' }, limit: MAX }))
        .map(toAttendanceRow);
    },
    createAttendance: (d) => rethrown(async () => (await strapi.documents(ATTENDANCE).create({ data: dataOf(d) })).documentId),
    updateAttendance: async (id, d) => {
      found(await strapi.documents(ATTENDANCE).update({ documentId: id, data: dataOf(d) }), 'updateAttendance');
    },
    deleteAttendance: async (id) => {
      deleted(await strapi.documents(ATTENDANCE).delete({ documentId: id }), 'deleteAttendance');
    },
  };
}

function lessonRows(strapi: Core.Strapi): Keys<'lessons' | 'lesson' | 'createLesson' | 'updateLesson' | 'deleteLesson'> {
  const query = (where: Where) => strapi.db.query(LESSON).findMany({ where, populate: ['athlete', 'coaches', 'priceList', 'series'], orderBy: { id: 'asc' }, limit: MAX });
  return {
    lessons: async (w = {}) => raws(await query({ ...docIds(w.ids), ...eq('athlete', w.athleteId), ...eq('series', w.seriesId), ...dated('date', w) })).map(toLessonRow),
    lesson: async (id) => {
      const [row] = raws(await query({ documentId: id }));
      return row ? toLessonRow(row) : null;
    },
    createLesson: async (d) => (await strapi.documents(LESSON).create({ data: dataOf(d) })).documentId,
    updateLesson: async (id, d) => {
      found(await strapi.documents(LESSON).update({ documentId: id, data: dataOf(d) }), 'updateLesson');
    },
    deleteLesson: async (id) => {
      deleted(await strapi.documents(LESSON).delete({ documentId: id }), 'deleteLesson');
    },
  };
}

/** Planned lessons deleted from today on; a row is plain data (the athlete by id, no relation) and goes with the daily purge. */
function cancelRows(strapi: Core.Strapi): Keys<'recordLessonCancel' | 'removeLessonCancel' | 'lessonCancels' | 'pruneLessonCancels'> {
  const slot = (r: { athleteId: string; date: string; startTime: string }): Where => ({ athleteId: r.athleteId, date: r.date, startTime: r.startTime });
  return {
    recordLessonCancel: async (row) => {
      if (await strapi.db.query(CANCEL).findOne({ where: slot(row) })) return;
      await strapi.documents(CANCEL).create({ data: { ...row } as never });
    },
    removeLessonCancel: async (row) => {
      await strapi.db.query(CANCEL).deleteMany({ where: slot(row) });
    },
    lessonCancels: async ({ athleteId, from, to }) =>
      raws(await strapi.db.query(CANCEL).findMany({ where: { athleteId, ...dated('date', { from, to }) }, orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { id: 'asc' }], limit: MAX }))
        .map((r) => ({ date: text(r.date), startTime: hhmm(str(r.startTime)) ?? '', durationMin: Number(r.durationMin ?? 0) })),
    pruneLessonCancels: async (before) => Number((await strapi.db.query(CANCEL).deleteMany({ where: { date: { $lt: before } } })).count),
  };
}

function seriesRows(strapi: Core.Strapi): Keys<'lessonSeries' | 'lessonSeriesOf' | 'createLessonSeries' | 'updateLessonSeries' | 'deleteLessonSeries'> {
  const query = (where: Where) => strapi.db.query(SERIES).findMany({ where, populate: ['athlete', 'coaches'], orderBy: [{ from: 'asc' }, { id: 'asc' }], limit: MAX });
  return {
    lessonSeries: async (id) => {
      const [row] = raws(await query({ documentId: id }));
      return row ? toLessonSeriesRow(row) : null;
    },
    lessonSeriesOf: async (athleteId) => raws(await query(eq('athlete', athleteId))).map(toLessonSeriesRow),
    createLessonSeries: async (d) => (await strapi.documents(SERIES).create({ data: dataOf(d) })).documentId,
    updateLessonSeries: async (id, d) => {
      found(await strapi.documents(SERIES).update({ documentId: id, data: dataOf(d) }), 'updateLessonSeries');
    },
    deleteLessonSeries: async (id) => {
      deleted(await strapi.documents(SERIES).delete({ documentId: id }), 'deleteLessonSeries');
    },
  };
}

function subscriptionRows(strapi: Core.Strapi): Keys<'subscriptions' | 'subscription' | 'createSubscription' | 'updateSubscription' | 'deleteSubscription'> {
  const query = (where: Where) => strapi.db.query(SUBSCRIPTION).findMany({ where, populate: ['athlete', 'season', 'priceList', 'validIn'], orderBy: { id: 'asc' }, limit: MAX });
  return {
    subscriptions: async (w = {}) => raws(await query({ ...docIds(w.ids), ...eq('athlete', w.athleteId) })).map(toSubscriptionRow),
    subscription: async (id) => {
      const [row] = raws(await query({ documentId: id }));
      return row ? toSubscriptionRow(row) : null;
    },
    createSubscription: async (d, code) => (await strapi.documents(SUBSCRIPTION).create({ data: dataOf({ ...d, code }) })).documentId,
    updateSubscription: async (id, d) => {
      found(await strapi.documents(SUBSCRIPTION).update({ documentId: id, data: dataOf(d) }), 'updateSubscription');
    },
    deleteSubscription: async (id) => {
      deleted(await strapi.documents(SUBSCRIPTION).delete({ documentId: id }), 'deleteSubscription');
    },
  };
}

function paymentRows(strapi: Core.Strapi): Keys<'payments' | 'payment' | 'createPayment' | 'updatePayment' | 'deletePayment'> {
  const query = (where: Where) =>
    strapi.db.query(PAYMENT).findMany({ where, populate: ['athlete', 'subscription', 'lesson', 'season', 'emailJob'], orderBy: { id: 'asc' }, limit: MAX });
  return {
    payments: async (w = {}) =>
      raws(await query({ ...docIds(w.ids), ...eq('athlete', w.athleteId), ...eq('subscription', w.subscriptionId), ...eq('lesson', w.lessonId), ...dated('paidOn', w) })).map(toPaymentRow),
    payment: async (id) => {
      const [row] = raws(await query({ documentId: id }));
      return row ? toPaymentRow(row) : null;
    },
    createPayment: async (d, receiptNo) => (await strapi.documents(PAYMENT).create({ data: dataOf({ ...d, receiptNo }) })).documentId,
    updatePayment: async (id, d) => {
      found(await strapi.documents(PAYMENT).update({ documentId: id, data: dataOf(d) }), 'updatePayment');
    },
    deletePayment: async (id) => {
      deleted(await strapi.documents(PAYMENT).delete({ documentId: id }), 'deletePayment');
    },
  };
}

function jobs(strapi: Core.Strapi): Keys<'createPaymentEmailJob' | 'cancelPaymentEmailJob' | 'sentPaymentEmailJobs'> {
  const query = () => strapi.db.query(JOB);
  return {
    createPaymentEmailJob: async (job) =>
      (await strapi.documents(JOB).create({
        data: { kind: 'payment', subject: job.subject, recipient: job.recipient, payload: job.payload, notBefore: job.notBefore, payment: job.paymentId, status: 'queued', attempts: 0 } as never,
      })).documentId,
    cancelPaymentEmailJob: async (paymentId) => {
      const queued = raws(await query().findMany({ where: { payment: { documentId: paymentId }, status: 'queued' }, select: ['id'], limit: MAX }));
      if (!queued.length) return 0;
      return (await query().updateMany({ where: { id: { $in: queued.map((j) => j.id) }, status: 'queued' }, data: { status: 'cancelled', updatedAt: new Date() } })).count;
    },
    sentPaymentEmailJobs: (paymentId) => query().count({ where: { payment: { documentId: paymentId }, status: { $in: ['sending', 'sent'] } } }),
  };
}

/** One upsert per number: the `ON CONFLICT DO UPDATE` row lock is the only serialisation between concurrent creates (as the portal `lockLimit`). */
export function strapiCounters(strapi: Core.Strapi, scope: Scope): Keys<'nextCounter' | 'raiseCounter' | 'counterValue'> {
  const upsert = async (key: string, initial: number, merged: Knex.Raw): Promise<number> => {
    const trx = scope.current();
    if (!trx) throw new Error('counter taken outside a transaction');
    const now = new Date();
    const rows: { value: unknown }[] = await strapi.db.getConnection(COUNTER_TABLE).transacting(trx)
      .insert({ document_id: createId(), key, value: initial, created_at: now, updated_at: now, published_at: now })
      .onConflict('key').merge({ value: merged, updated_at: now }).returning('value');
    return Number(rows[0]?.value);
  };
  const raw = (sql: string, args: Knex.RawBinding[] = []): Knex.Raw => strapi.db.connection.raw(sql, args);
  return {
    nextCounter: (key) => upsert(key, 1, raw(`${COUNTER_TABLE}.value + 1`)),
    raiseCounter: async (key, atLeast) => {
      await upsert(key, atLeast, raw(`greatest(${COUNTER_TABLE}.value, ?)`, [atLeast]));
    },
    counterValue: async (key) => {
      const trx = scope.current();
      const query = strapi.db.getConnection(COUNTER_TABLE).where('key', key);
      const row = await (trx ? query.transacting(trx) : query).first('value');
      return row ? Number(row.value) : 0;
    },
  };
}

/** PresenceStore on Strapi: db queries for reads (relations as documentIds), document service for writes, one transaction scope for every lock. */
export function strapiPresenceStore(strapi: Core.Strapi): PresenceStore {
  const scope = transactionScope(strapi);
  // The group store's own season, group and event locks would use its scope, where no transaction is active; these use ours (order: seasons > athletes > groups > events).
  const groupLocks = {
    lockSeason: (id: string) => scope.lockRow('seasons', id),
    lockGroup: (id: string) => scope.lockRow('club_groups', id),
    lockEvent: (id: string) => scope.lockRow('calendar_events', id),
  };
  return {
    ...strapiGroupStore(strapi),
    ...groupLocks,
    transaction: scope.transaction,
    lockAthlete: (id) => scope.lockRow('athletes', id),
    lockHistoryEntry: (id) => scope.lockRow('history_entries', id),
    lockSession: (id) => scope.lockRow('club_sessions', id),
    lockLessonSeries: (id) => scope.lockRow('club_lesson_series', id),
    lockLesson: (id) => scope.lockRow('club_individual_lessons', id),
    lockAttendance: (id) => scope.lockRow('club_attendances', id),
    lockSubscription: (id) => scope.lockRow('club_subscriptions', id),
    lockPayment: (id) => scope.lockRow('club_payments', id),
    ...lookups(strapi), ...sessionRows(strapi), ...attendanceRows(strapi), ...historyPages(strapi), ...lessonRows(strapi), ...cancelRows(strapi), ...seriesRows(strapi), ...subscriptionRows(strapi), ...paymentRows(strapi), ...jobs(strapi),
    ...strapiCounters(strapi, scope),
  };
}
