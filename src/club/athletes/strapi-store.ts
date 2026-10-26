import type { Core } from '@strapi/strapi';
import type { Knex } from 'knex';
import type { AthleteStatus } from '../athlete-data';
import type { ConfirmationRecord, RegistrationStatus } from '../confirm/plan';
import { recordHistory } from '../history';
import type { AcsState } from '../acs';
import type {
  AcsRow, AthleteRow, AthleteWrite, ClubStore, DuplicateRow, GroupRow, HistoryRow, MembershipRow, ProfileRow, RegistrationPatch, RegistrationRow, SeasonRow, SectionRow,
} from './store';

const ATHLETE = 'api::athlete.athlete' as const;
const REGISTRATION = 'api::registration-submission.registration-submission' as const;
const SEASON = 'api::season.season' as const;
const SECTION = 'api::section.section' as const;
const GROUP = 'api::group.group' as const;
const MEMBERSHIP = 'api::group-membership.group-membership' as const;
const ACS = 'api::acs-membership.acs-membership' as const;
const DUPLICATE = 'api::athlete-duplicate.athlete-duplicate' as const;
const PROFILE = 'api::sportsperson.sportsperson' as const;
const COMPETITION = 'api::competition.competition' as const;
const HISTORY = 'api::history-entry.history-entry' as const;
const MAX = 100000;

type Raw = Record<string, unknown>;
const raws = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : str(v));
const linkId = (v: unknown): string | null => (v && typeof v === 'object' ? str((v as Raw).documentId) : null);
const STATUSES: readonly RegistrationStatus[] = ['Nou', 'Contactat', 'Confirmat', 'Respins'];
const ATHLETE_STATUSES: readonly AthleteStatus[] = ['nou', 'activ', 'inactiv'];
const ACS_STATES: readonly AcsState[] = ['da', 'nu', 'in_asteptare'];
const oneOf = <T extends string>(values: readonly T[], v: unknown, fallback: T): T => values.find((x) => x === v) ?? fallback;

export function toAthleteRow(r: Raw): AthleteRow {
  return {
    id: text(r.documentId), name: str(r.name), birthDate: str(r.birthDate), contactName: str(r.contactName), phone: str(r.phone), email: str(r.email),
    status: oneOf(ATHLETE_STATUSES, r.status, 'activ'), dataIncomplete: r.dataIncomplete === true, profileId: linkId(r.publicProfile), updatedAt: iso(r.updatedAt) ?? '',
  };
}

const confirmationOf = (v: unknown): ConfirmationRecord | null =>
  v && typeof v === 'object' && typeof (v as Raw).athleteId === 'string' ? (v as ConfirmationRecord) : null;
const answerOf = (v: unknown): 'da' | 'nu' | null => (v === 'da' || v === 'nu' ? v : null);
const levelOf = (v: unknown): 'sigur' | 'probabil' | null => (v === 'sigur' || v === 'probabil' ? v : null);

export function toRegistrationRow(r: Raw): RegistrationRow {
  return {
    id: text(r.documentId), number: str(r.registrationNumber), childName: text(r.childName), childBirthDate: text(r.childBirthDate),
    parentName: text(r.parentName), phone: text(r.phone), email: text(r.email), status: oneOf(STATUSES, r.status, 'Nou'), archived: r.archived === true,
    season: str(r.season), seasonId: linkId(r.seasonRef), sectionId: linkId(r.section), athleteId: linkId(r.athlete), matchAthleteId: linkId(r.matchAthlete),
    matchLevel: levelOf(r.matchLevel), childBirthDateParsed: str(r.childBirthDateParsed), membershipAnswer: answerOf(r.membershipAnswer),
    lastSeason: str(r.lastSeason), subscriptionChoice: r.subscriptionChoice ?? null, confirmation: confirmationOf(r.confirmation), submittedAt: iso(r.submittedAt),
  };
}

const slugList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);

export function toProfileRows(rows: Raw[]): ProfileRow[] {
  const byId = new Map<string, ProfileRow>();
  for (const r of rows) {
    const id = text(r.documentId);
    const before = byId.get(id);
    const published = r.publishedAt !== null && r.publishedAt !== undefined;
    byId.set(id, {
      id, name: text(r.name), slug: text(r.slug),
      previousSlugs: slugList(r.previousSlugs).length ? slugList(r.previousSlugs) : before?.previousSlugs ?? [],
      showPublicPage: published ? r.showPublicPage === true : before?.showPublicPage === true,
      published: published || before?.published === true,
    });
  }
  return [...byId.values()];
}

export const toDuplicateRow = (r: Raw): DuplicateRow => ({
  id: text(r.documentId), firstId: linkId(r.first) ?? '', secondId: linkId(r.second) ?? '', dismissed: r.dismissed === true,
});

const toMembership = (r: Raw): MembershipRow => ({
  id: text(r.documentId), athleteId: linkId(r.athlete) ?? '', groupId: linkId(r.group) ?? '', seasonId: linkId(r.season) ?? '', isMain: r.isMain === true, from: str(r.from),
});
const toAcs = (r: Raw): AcsRow => ({ id: text(r.documentId), athleteId: linkId(r.athlete) ?? '', seasonId: linkId(r.season) ?? '', state: oneOf(ACS_STATES, r.state, 'nu') });
const toHistory = (r: Raw): HistoryRow => ({
  seq: Number(r.id), subjectType: text(r.subjectType), subjectId: text(r.subjectId), action: text(r.action),
  changes: r.changes && typeof r.changes === 'object' ? (r.changes as Record<string, unknown>) : {}, actor: text(r.actor), at: iso(r.at) ?? '',
});

const REGISTRATION_POPULATE: ('athlete' | 'matchAthlete' | 'section' | 'seasonRef')[] = ['athlete', 'matchAthlete', 'section', 'seasonRef'];
const LINKS: ('athlete' | 'group' | 'season')[] = ['athlete', 'group', 'season'];

function registrationReads(strapi: Core.Strapi): Pick<ClubStore, 'registration' | 'registrations'> {
  const regs = () => strapi.documents(REGISTRATION);
  return {
    registration: async (id) => {
      const r = await regs().findOne({ documentId: id, populate: REGISTRATION_POPULATE });
      return r ? toRegistrationRow(r as unknown as Raw) : null;
    },
    registrations: async (where = {}) => {
      const filters = where.athleteId ? { athlete: { documentId: where.athleteId } } : {};
      return raws(await regs().findMany({ filters, populate: REGISTRATION_POPULATE, limit: MAX })).map(toRegistrationRow);
    },
  };
}

function clubReads(strapi: Core.Strapi): Pick<ClubStore, 'athlete' | 'athletes' | 'seasons' | 'sections' | 'groups'> {
  const athletes = () => strapi.documents(ATHLETE);
  return {
    athlete: async (id) => {
      const a = await athletes().findOne({ documentId: id, populate: ['publicProfile'] });
      return a ? toAthleteRow(a as unknown as Raw) : null;
    },
    athletes: async () => raws(await athletes().findMany({ populate: ['publicProfile'], limit: MAX })).map(toAthleteRow),
    seasons: async () => raws(await strapi.documents(SEASON).findMany({ limit: 1000 })).map((s): SeasonRow => ({
      id: text(s.documentId), label: text(s.label), startMonth: text(s.startMonth), endMonth: text(s.endMonth), isCurrent: s.isCurrent === true,
    })),
    sections: async () => raws(await strapi.documents(SECTION).findMany({ limit: 1000 })).map((s): SectionRow => ({
      id: text(s.documentId), name: text(s.name), kind: s.kind === 'club' ? 'club' : 'school', publicPage: s.publicPage === true, order: typeof s.order === 'number' ? s.order : null,
    })),
    groups: async () => raws(await strapi.documents(GROUP).findMany({ populate: ['section'], limit: 1000 })).map((g): GroupRow => ({
      id: text(g.documentId), name: text(g.name), sectionId: linkId(g.section), order: typeof g.order === 'number' ? g.order : null, active: g.active !== false,
    })),
  };
}

function rowReads(strapi: Core.Strapi): Pick<ClubStore, 'memberships' | 'acsRows' | 'duplicates' | 'profiles'> {
  const byAthlete = (athleteId?: string) => (athleteId ? { athlete: { documentId: athleteId } } : {});
  return {
    memberships: async (athleteId) => raws(await strapi.documents(MEMBERSHIP).findMany({ filters: byAthlete(athleteId), populate: LINKS, limit: MAX })).map(toMembership),
    acsRows: async (athleteId) =>
      raws(await strapi.documents(ACS).findMany({ filters: byAthlete(athleteId), populate: ['athlete', 'season'], limit: MAX })).map(toAcs),
    duplicates: async () =>
      raws(await strapi.documents(DUPLICATE).findMany({ populate: ['first', 'second'], limit: MAX }))
        .map(toDuplicateRow)
        .filter((d) => d.firstId && d.secondId),
    profiles: async () =>
      toProfileRows(raws(await strapi.db.query(PROFILE).findMany({ select: ['documentId', 'name', 'slug', 'showPublicPage', 'publishedAt', 'previousSlugs'], limit: MAX }))),
  };
}

function historyReads(strapi: Core.Strapi): Pick<ClubStore, 'history' | 'historyByAction' | 'adminNames'> {
  const query = (where: Raw) => strapi.db.query(HISTORY).findMany({ where, orderBy: { id: 'asc' }, limit: MAX });
  return {
    history: async (subjectType, subjectId) => raws(await query({ subjectType, subjectId })).map(toHistory),
    historyByAction: async (action) => raws(await query({ action })).map(toHistory),
    adminNames: async (emails) => {
      const users = raws(await strapi.db.query('admin::user').findMany({ where: { email: { $in: emails } }, select: ['email', 'firstname', 'lastname'] }));
      return Object.fromEntries(users.map((u) => [text(u.email), `${text(u.firstname)} ${text(u.lastname)}`.trim() || text(u.email)]));
    },
  };
}

const PATCH_KEYS: Readonly<Record<string, string>> = { athleteId: 'athlete', matchAthleteId: 'matchAthlete', sectionId: 'section' };
const registrationData = (p: RegistrationPatch): Raw => Object.fromEntries(Object.entries(p).map(([k, v]) => [PATCH_KEYS[k] ?? k, v]));
/** The athlete fields as Strapi names them (`profileId` is the `publicProfile` relation); typed, so `create` type-checks. */
function athleteFields(d: AthleteWrite) {
  const { profileId, ...rest } = d;
  return profileId === undefined ? rest : { ...rest, publicProfile: profileId };
}

function athleteWrites(strapi: Core.Strapi): Pick<ClubStore, 'updateRegistration' | 'createAthlete' | 'updateAthlete' | 'deleteAthlete'> {
  return {
    updateRegistration: async (id, patch) => {
      await strapi.documents(REGISTRATION).update({ documentId: id, data: registrationData(patch) });
    },
    createAthlete: async (data) => (await strapi.documents(ATHLETE).create({ data: { status: 'activ' as const, ...athleteFields(data) } })).documentId,
    updateAthlete: async (id, data) => {
      await strapi.documents(ATHLETE).update({ documentId: id, data: athleteFields(data) });
    },
    deleteAthlete: async (id) => {
      await strapi.documents(ATHLETE).delete({ documentId: id });
    },
  };
}

type RowWrites = 'createMembership' | 'updateMembership' | 'deleteMembership' | 'createAcs' | 'updateAcs' | 'deleteAcs' | 'createDuplicate' | 'dismissDuplicate' | 'deleteDuplicate';

function rowWrites(strapi: Core.Strapi): Pick<ClubStore, RowWrites> {
  const links = (d: { athleteId?: string; groupId?: string; seasonId?: string }) =>
    Object.fromEntries(Object.entries({ athlete: d.athleteId, group: d.groupId, season: d.seasonId }).filter(([, v]) => v !== undefined));
  const del = (uid: typeof MEMBERSHIP | typeof ACS | typeof DUPLICATE) => async (id: string) => {
    await strapi.documents(uid).delete({ documentId: id });
  };
  return {
    createMembership: async (d) => (await strapi.documents(MEMBERSHIP).create({ data: { ...links(d), isMain: d.isMain, from: d.from } })).documentId,
    updateMembership: async (id, d) => {
      await strapi.documents(MEMBERSHIP).update({ documentId: id, data: { ...links(d), ...(d.isMain === undefined ? {} : { isMain: d.isMain }) } });
    },
    deleteMembership: del(MEMBERSHIP),
    createAcs: async (d) => (await strapi.documents(ACS).create({ data: { ...links(d), state: d.state } })).documentId,
    updateAcs: async (id, d) => {
      await strapi.documents(ACS).update({ documentId: id, data: { ...links(d), ...(d.state === undefined ? {} : { state: d.state }) } });
    },
    deleteAcs: del(ACS),
    createDuplicate: async (firstId, secondId) => {
      await strapi.documents(DUPLICATE).create({ data: { first: firstId, second: secondId } });
    },
    dismissDuplicate: async (id) => {
      await strapi.documents(DUPLICATE).update({ documentId: id, data: { dismissed: true } });
    },
    deleteDuplicate: del(DUPLICATE),
  };
}

/** A deleted profile takes its competition participations with it (spec 6.6); the competition lifecycle re-syncs the relation. */
async function removeParticipations(strapi: Core.Strapi, profileId: string): Promise<void> {
  const competitions = raws(await strapi.documents(COMPETITION).findMany({ fields: ['participantData'], limit: MAX }));
  for (const c of competitions) {
    const list = Array.isArray(c.participantData) ? c.participantData : [];
    const kept = list.filter((p) => !(p && typeof p === 'object' && (p as Raw).documentId === profileId));
    if (kept.length !== list.length) await strapi.documents(COMPETITION).update({ documentId: text(c.documentId), data: { participantData: kept } });
  }
}

function profileWrites(strapi: Core.Strapi): Pick<ClubStore, 'createProfile' | 'renameProfile' | 'setProfileVisibility' | 'setPreviousSlugs' | 'deleteProfile'> {
  const bothRows = async (id: string, data: Raw) => {
    await strapi.db.query(PROFILE).updateMany({ where: { documentId: id }, data });
  };
  return {
    createProfile: async (name, slug) => (await strapi.documents(PROFILE).create({ data: { name, slug, showPublicPage: false }, status: 'published' })).documentId,
    renameProfile: (id, name) => bothRows(id, { name }),
    setProfileVisibility: (id, on) => bothRows(id, { showPublicPage: on }),
    setPreviousSlugs: (id, slugs) => bothRows(id, { previousSlugs: slugs }),
    deleteProfile: async (id) => {
      await removeParticipations(strapi, id);
      await strapi.documents(PROFILE).delete({ documentId: id });
    },
  };
}

/** ClubStore on Strapi: document service for writes (validation, lifecycles), db queries for bulk reads. */
export function strapiClubStore(strapi: Core.Strapi): ClubStore {
  let active: Knex.Transaction | null = null;
  return {
    async transaction<T>(work: () => Promise<T>): Promise<T> {
      return await strapi.db.transaction(async ({ trx }: { trx: Knex.Transaction }) => {
        active = trx;
        try {
          return await work();
        } finally {
          active = null;
        }
      });
    },
    lockRegistration: async (id) => {
      if (active) await strapi.db.connection('registration_submissions').transacting(active).forUpdate().where('document_id', id).select('id');
    },
    ...registrationReads(strapi),
    ...clubReads(strapi),
    ...rowReads(strapi),
    ...historyReads(strapi),
    ...athleteWrites(strapi),
    ...rowWrites(strapi),
    ...profileWrites(strapi),
    moveHistory: async (from, to) => {
      await strapi.db.query(HISTORY).updateMany({ where: { subjectType: 'athlete', subjectId: from }, data: { subjectId: to } });
    },
    record: (entry) => recordHistory(strapi, entry),
  };
}
