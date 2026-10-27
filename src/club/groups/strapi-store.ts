import type { Core } from '@strapi/strapi';
import { iso, linkId, raws, str, strapiClubStore, text, toMembership, transactionScope } from '../athletes/strapi-store';
import type { Raw } from '../athletes/strapi-store';
import { buildHistoryEntry } from '../history';
import { isRecord } from '../narrow';
import { hhmm } from './dates';
import type {
  BreakRecord, DayKey, EventRecord, ExceptionKind, ExceptionRow, Freq, GroupRecord, GroupStore, HistoryEntryRow, Recurrence, SeasonRecord, SectionRecord, WeekOfMonth,
} from './types';

const GROUP = 'api::group.group' as const;
const SECTION = 'api::section.section' as const;
const SEASON = 'api::season.season' as const;
const TEAM = 'api::team-member.team-member' as const;
const PRICE_LIST = 'api::price-list.price-list' as const;
const MEMBERSHIP = 'api::group-membership.group-membership' as const;
const ATHLETE = 'api::athlete.athlete' as const;
const REGISTRATION = 'api::registration-submission.registration-submission' as const;
const EVENT = 'api::calendar-event.calendar-event' as const;
const BLACKOUT = 'api::calendar-blackout.calendar-blackout' as const;
const JOB = 'api::email-job.email-job' as const;
const HISTORY = 'api::history-entry.history-entry' as const;
const MAX = 100000;
const BY_ID = 'id:asc' as const;
const EVENT_POPULATE: ('recurrence' | 'exceptions' | 'group')[] = ['recurrence', 'exceptions', 'group'];

const among = <T extends string>(values: readonly T[], v: unknown): T | null => values.find((x) => x === v) ?? null;
const DAYS: readonly DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const FREQS: readonly Freq[] = ['none', 'weekly', 'biweekly', 'monthly'];
const WEEKS: readonly WeekOfMonth[] = ['first', 'second', 'third', 'fourth', 'last'];
const KINDS: readonly ExceptionKind[] = ['cancel', 'override', 'liber', 'anulat'];
/** Strapi `time` attributes are written as "HH:mm:ss.SSS". */
const time = (t: string | null): string | null => (t ? `${t}:00.000` : null);

export function toGroupRecord(g: Raw): GroupRecord {
  return {
    id: text(g.documentId), name: text(g.name), sectionId: linkId(g.section), order: typeof g.order === 'number' ? g.order : null, active: g.active !== false,
    priceListId: linkId(g.priceList), coachIds: raws(g.coaches).map((c) => text(c.documentId)), programPublic: g.programPublic !== false,
  };
}

export function toRecurrence(r: Raw | null): Recurrence {
  const v = r ?? {};
  return {
    freq: among(FREQS, v.freq) ?? 'weekly', days: DAYS.filter((d) => v[d] === true), weekOfMonth: among(WEEKS, v.weekOfMonth),
    startTime: hhmm(str(v.startTime)), endTime: hhmm(str(v.endTime)), singleDate: str(v.singleDate), seasonStart: str(v.seasonStart), seasonEnd: str(v.seasonEnd),
  };
}

export const toException = (x: Raw): ExceptionRow => ({
  date: text(x.date), kind: among(KINDS, x.kind) ?? 'cancel', newDate: str(x.newDate), newStartTime: hhmm(str(x.newStartTime)),
  newEndTime: hhmm(str(x.newEndTime)), newTitle: str(x.newTitle), reason: str(x.reason),
});

export const toEventRecord = (e: Raw): EventRecord => ({
  id: text(e.documentId), title: text(e.title), type: text(e.type), description: str(e.description), groupId: linkId(e.group),
  recurrence: toRecurrence(isRecord(e.recurrence) ? e.recurrence : null), exceptions: raws(e.exceptions).map(toException),
});

export function recurrenceData(r: Recurrence): Raw {
  return {
    freq: r.freq, ...Object.fromEntries(DAYS.map((d) => [d, r.days.includes(d)])), weekOfMonth: r.weekOfMonth, startTime: time(r.startTime), endTime: time(r.endTime),
    endsNextDay: false, singleDate: r.singleDate, endDate: null, seasonStart: r.seasonStart, seasonEnd: r.seasonEnd,
  };
}

export const exceptionData = (x: ExceptionRow): Raw => ({
  date: x.date, kind: x.kind, newDate: x.newDate, newStartTime: time(x.newStartTime), newEndTime: time(x.newEndTime), newTitle: x.newTitle, reason: x.reason,
});

const fee = (v: unknown): number | null => (typeof v === 'number' ? v : v === null || v === undefined || v === '' ? null : Number(v));
const toSeason = (s: Raw): SeasonRecord => ({
  id: text(s.documentId), label: text(s.label), startMonth: text(s.startMonth), endMonth: text(s.endMonth), isCurrent: s.isCurrent === true, membershipFee: fee(s.membershipFee),
});
const toSection = (s: Raw): SectionRecord => ({
  id: text(s.documentId), name: text(s.name), kind: s.kind === 'club' ? 'club' : 'school', publicPage: s.publicPage === true,
  order: typeof s.order === 'number' ? s.order : null, slug: text(s.slug),
});
const toHistoryEntry = (r: Raw): HistoryEntryRow => ({
  id: text(r.documentId), seq: Number(r.id), subjectType: text(r.subjectType), subjectId: text(r.subjectId), action: text(r.action),
  changes: isRecord(r.changes) ? r.changes : {}, actor: text(r.actor), at: iso(r.at) ?? '',
});
const toBreak = (b: Raw): BreakRecord => ({ id: text(b.documentId), label: text(b.label), startDate: text(b.startDate), endDate: text(b.endDate) });

/** A document-service write on a missing row answers null (update) or no entries (delete) and no error; the action must not commit around it. */
const found = <T>(row: T | null | undefined, what: string): T => {
  if (row === null || row === undefined) throw new Error(`${what}: the row does not exist`);
  return row;
};
const deleted = (res: { entries?: unknown[] } | null | undefined, what: string): void => {
  if (!res || !res.entries?.length) throw new Error(`${what}: the row does not exist`);
};

type Keys<K extends keyof GroupStore> = Pick<GroupStore, K>;

function lookups(strapi: Core.Strapi): Keys<'seasons' | 'sections' | 'groups' | 'group' | 'teamMembers' | 'priceLists'> {
  const groups = () => strapi.documents(GROUP);
  const populate: ('section' | 'priceList' | 'coaches')[] = ['section', 'priceList', 'coaches'];
  return {
    seasons: async () => raws(await strapi.documents(SEASON).findMany({ sort: BY_ID, limit: 1000 })).map(toSeason),
    sections: async () => raws(await strapi.documents(SECTION).findMany({ sort: BY_ID, limit: 1000 })).map(toSection),
    groups: async () => raws(await groups().findMany({ populate, sort: BY_ID, limit: 1000 })).map(toGroupRecord),
    group: async (id) => {
      const g = await groups().findOne({ documentId: id, populate });
      return g ? toGroupRecord(g as unknown as Raw) : null;
    },
    teamMembers: async () => raws(await strapi.documents(TEAM).findMany({ fields: ['name'], sort: ['order:asc', 'name:asc'], limit: 1000 })).map((t) => ({ id: text(t.documentId), name: text(t.name) })),
    priceLists: async () =>
      raws(await strapi.documents(PRICE_LIST).findMany({ fields: ['name'], populate: ['section'], sort: BY_ID, limit: 1000 })).map((p) => ({ id: text(p.documentId), name: text(p.name), sectionId: linkId(p.section) })),
  };
}

function peopleReads(strapi: Core.Strapi): Keys<'athletes' | 'athlete' | 'memberships' | 'membership' | 'registrations' | 'registrationsFiledAfter' | 'adminNames'> {
  const club = strapiClubStore(strapi);
  const by = (key: string, id: string | undefined) => (id ? { [key]: { documentId: id } } : {});
  return {
    athletes: () => club.athletes(),
    athlete: (id) => club.athlete(id),
    memberships: async (w = {}) => {
      const filters = { ...by('season', w.seasonId), ...by('group', w.groupId), ...by('athlete', w.athleteId) };
      return raws(await strapi.documents(MEMBERSHIP).findMany({ filters, populate: ['athlete', 'group', 'season'], sort: BY_ID, limit: MAX })).map(toMembership);
    },
    membership: async (id) => {
      const m = await strapi.documents(MEMBERSHIP).findOne({ documentId: id, populate: ['athlete', 'group', 'season'] });
      return m ? toMembership(m as unknown as Raw) : null;
    },
    registrations: () => club.registrations(),
    registrationsFiledAfter: (seasonId, at) => strapi.documents(REGISTRATION).count({ filters: { seasonRef: { documentId: seasonId }, createdAt: { $gt: at } } }),
    adminNames: (emails) => club.adminNames(emails),
  };
}

function calendarReads(strapi: Core.Strapi): Keys<'events' | 'event' | 'breaks'> {
  const events = () => strapi.documents(EVENT);
  return {
    events: async (w = {}) => {
      const filters = w.groupId ? { group: { documentId: w.groupId } } : {};
      return raws(await events().findMany({ filters, populate: EVENT_POPULATE, sort: BY_ID, limit: MAX })).map(toEventRecord);
    },
    event: async (id) => {
      const e = await events().findOne({ documentId: id, populate: EVENT_POPULATE });
      return e ? toEventRecord(e as unknown as Raw) : null;
    },
    breaks: async () => raws(await strapi.documents(BLACKOUT).findMany({ sort: ['startDate:asc', 'id:asc'], limit: 1000 })).map(toBreak),
  };
}

function historyReads(strapi: Core.Strapi): Keys<'history' | 'historyEntry' | 'historyAfter'> {
  const query = (where: Raw) => strapi.db.query(HISTORY).findMany({ where, orderBy: { id: 'asc' }, limit: MAX });
  return {
    history: async (subjectType, subjectId) => raws(await query({ subjectType, subjectId })).map(toHistoryEntry),
    historyEntry: async (id) => {
      const row = await strapi.db.query(HISTORY).findOne({ where: { documentId: id } });
      return row ? toHistoryEntry(row as Raw) : null;
    },
    historyAfter: async (seq, subjects) => {
      if (subjects === null) return raws(await query({ id: { $gt: seq } })).map(toHistoryEntry);
      if (!subjects.length) return [];
      return raws(await query({ id: { $gt: seq }, $or: subjects.map((s) => ({ subjectType: s.type, subjectId: s.id })) })).map(toHistoryEntry);
    },
  };
}

function groupWrites(strapi: Core.Strapi): Keys<'createGroup' | 'updateGroup' | 'deleteGroup' | 'setAthleteStatus' | 'setSeasonCurrent'> {
  const groups = () => strapi.documents(GROUP);
  const relations = (d: { sectionId?: string; priceListId?: string | null; coachIds?: string[] }) => ({
    ...(d.sectionId === undefined ? {} : { section: d.sectionId }),
    ...(d.priceListId === undefined ? {} : { priceList: d.priceListId }),
    ...(d.coachIds === undefined ? {} : { coaches: d.coachIds }),
  });
  return {
    createGroup: async (d) => (await groups().create({ data: { name: d.name, order: d.order, active: true, programPublic: d.programPublic, ...relations(d) } })).documentId,
    updateGroup: async (id, d) => {
      found(await groups().update({ documentId: id, data: { ...(d.name === undefined ? {} : { name: d.name }), ...(d.programPublic === undefined ? {} : { programPublic: d.programPublic }), ...relations(d) } }), 'updateGroup');
    },
    deleteGroup: async (id) => {
      deleted(await groups().delete({ documentId: id }), 'deleteGroup');
    },
    setAthleteStatus: async (id, status) => {
      found(await strapi.documents(ATHLETE).update({ documentId: id, data: { status } }), 'setAthleteStatus');
    },
    setSeasonCurrent: async (id, isCurrent) => {
      found(await strapi.documents(SEASON).update({ documentId: id, data: { isCurrent } }), 'setSeasonCurrent');
    },
  };
}

function membershipWrites(strapi: Core.Strapi): Keys<'createMembership' | 'updateMembership' | 'deleteMembership'> {
  const rows = () => strapi.documents(MEMBERSHIP);
  return {
    createMembership: async (d) =>
      (await rows().create({ data: { athlete: d.athleteId, group: d.groupId, season: d.seasonId, isMain: d.isMain, from: d.from, to: d.to ?? null } })).documentId,
    updateMembership: async (id, d) => {
      found(await rows().update({ documentId: id, data: { ...(d.isMain === undefined ? {} : { isMain: d.isMain }), ...(d.to === undefined ? {} : { to: d.to }) } }), 'updateMembership');
    },
    deleteMembership: async (id) => {
      deleted(await rows().delete({ documentId: id }), 'deleteMembership');
    },
  };
}

function calendarWrites(strapi: Core.Strapi): Keys<'createEvent' | 'updateEvent' | 'deleteEvent' | 'createBreak' | 'updateBreak' | 'deleteBreak'> {
  const events = () => strapi.documents(EVENT);
  const blackouts = () => strapi.documents(BLACKOUT);
  return {
    createEvent: async (d) => (await events().create({
      data: { title: d.title, type: d.type as 'curs', description: d.description, group: d.groupId, recurrence: recurrenceData(d.recurrence), exceptions: d.exceptions.map(exceptionData) } as never,
    })).documentId,
    updateEvent: async (id, d) => {
      const data = { ...(d.title === undefined ? {} : { title: d.title }), ...(d.recurrence ? { recurrence: recurrenceData(d.recurrence) } : {}), ...(d.exceptions ? { exceptions: d.exceptions.map(exceptionData) } : {}) };
      found(await events().update({ documentId: id, data: data as never }), 'updateEvent');
    },
    deleteEvent: async (id) => {
      deleted(await events().delete({ documentId: id }), 'deleteEvent');
    },
    createBreak: async (d) => (await blackouts().create({ data: d })).documentId,
    updateBreak: async (id, d) => {
      found(await blackouts().update({ documentId: id, data: d }), 'updateBreak');
    },
    deleteBreak: async (id) => {
      deleted(await blackouts().delete({ documentId: id }), 'deleteBreak');
    },
  };
}

function jobAndHistoryWrites(strapi: Core.Strapi): Keys<'createEmailJobs' | 'cancelEmailJobs' | 'sentEmailJobs' | 'recordAction' | 'record' | 'setHistoryChanges'> {
  return {
    createEmailJobs: async (jobs) => {
      for (const j of jobs) {
        await strapi.documents(JOB).create({
          data: { recipient: j.recipient, subject: j.subject, kind: 'schedule-change', group: j.groupId, payload: j.payload, changeKey: j.changeKey, notBefore: j.notBefore, status: 'queued', attempts: 0 },
        });
      }
      return jobs.length;
    },
    cancelEmailJobs: async (changeKey) => (await strapi.db.query(JOB).updateMany({ where: { changeKey, status: 'queued' }, data: { status: 'cancelled' } })).count,
    sentEmailJobs: (changeKey) => strapi.db.query(JOB).count({ where: { changeKey, status: 'sent' } }),
    recordAction: async (entry) => {
      const row = await strapi.documents(HISTORY).create({ data: buildHistoryEntry(entry) as never });
      return { id: row.documentId, seq: Number(row.id) };
    },
    record: async (entry) => {
      await strapi.documents(HISTORY).create({ data: buildHistoryEntry(entry) as never });
    },
    setHistoryChanges: async (id, changes) => {
      found(await strapi.db.query(HISTORY).update({ where: { documentId: id }, data: { changes } }), 'setHistoryChanges');
    },
  };
}

/** GroupStore on Strapi: document service for writes (validation, lifecycles, the recurrence check), db queries for history. */
export function strapiGroupStore(strapi: Core.Strapi): GroupStore {
  const scope = transactionScope(strapi);
  return {
    transaction: scope.transaction,
    lockSeason: (id) => scope.lockRow('seasons', id),
    lockAthlete: (id) => scope.lockRow('athletes', id),
    lockGroup: (id) => scope.lockRow('club_groups', id),
    lockEvent: (id) => scope.lockRow('calendar_events', id),
    lockHistoryEntry: (id) => scope.lockRow('history_entries', id),
    ...lookups(strapi), ...peopleReads(strapi), ...calendarReads(strapi), ...historyReads(strapi),
    ...groupWrites(strapi), ...membershipWrites(strapi), ...calendarWrites(strapi), ...jobAndHistoryWrites(strapi),
  };
}
