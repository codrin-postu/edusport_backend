import type { Core } from '@strapi/strapi';
import type { Knex } from 'knex';
import { ATHLETE_STATUSES } from '../athlete-data';
import type { ConfirmationRecord, RegistrationStatus } from '../confirm/plan';
import { recordHistory } from '../history';
import { scrubbedJobStatus } from '../personal-data/anonymize-plan';
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
const JOB = 'api::email-job.email-job' as const;
const SETTINGS = 'api::site-settings.site-settings' as const;
const FILE = 'plugin::upload.file' as const;
const MAX = 100000;
const BY_ID = 'id:asc' as const;

export type Raw = Record<string, unknown>;
export const raws = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
export const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
export const text = (v: unknown): string => (typeof v === 'string' ? v : '');
export const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : str(v));
export const linkId = (v: unknown): string | null => (v && typeof v === 'object' ? str((v as Raw).documentId) : null);
const STATUSES: readonly RegistrationStatus[] = ['Nou', 'Contactat', 'Confirmat', 'Respins'];
const ACS_STATES: readonly AcsState[] = ['da', 'nu', 'in_asteptare'];
const oneOf = <T extends string>(values: readonly T[], v: unknown, fallback: T): T => values.find((x) => x === v) ?? fallback;

export function toAthleteRow(r: Raw): AthleteRow {
  return {
    id: text(r.documentId), name: str(r.name), birthDate: str(r.birthDate), contactName: str(r.contactName), phone: str(r.phone), email: str(r.email),
    status: oneOf(ATHLETE_STATUSES, r.status, 'activ'), dataIncomplete: r.dataIncomplete === true, profileId: linkId(r.publicProfile), notes: str(r.notes),
    updatedAt: iso(r.updatedAt) ?? '', createdAt: iso(r.createdAt) ?? '', anonymizedAt: iso(r.anonymizedAt),
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

const isPublished = (r: Raw): boolean => r.publishedAt !== null && r.publishedAt !== undefined;

/** Draft rows first, so the published row, when there is one, decides name, slug and visibility. */
export function toProfileRows(rows: Raw[]): ProfileRow[] {
  const byId = new Map<string, ProfileRow>();
  for (const r of [...rows.filter((x) => !isPublished(x)), ...rows.filter(isPublished)]) {
    const id = text(r.documentId);
    const before = byId.get(id);
    const published = isPublished(r);
    byId.set(id, {
      id, name: text(r.name), slug: text(r.slug),
      previousSlugs: slugList(r.previousSlugs).length ? slugList(r.previousSlugs) : before?.previousSlugs ?? [],
      showPublicPage: published && r.showPublicPage === true,
      published,
    });
  }
  return [...byId.values()];
}

export const toDuplicateRow = (r: Raw): DuplicateRow => ({
  id: text(r.documentId), firstId: linkId(r.first) ?? '', secondId: linkId(r.second) ?? '', dismissed: r.dismissed === true,
});

export const toMembership = (r: Raw): MembershipRow => ({
  id: text(r.documentId), athleteId: linkId(r.athlete) ?? '', groupId: linkId(r.group) ?? '', seasonId: linkId(r.season) ?? '', isMain: r.isMain === true,
  from: str(r.from), to: str(r.to),
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
      const filters = {
        ...(where.athleteId ? { athlete: { documentId: where.athleteId } } : {}),
        ...(where.matchAthleteId ? { matchAthlete: { documentId: where.matchAthleteId } } : {}),
      };
      return raws(await regs().findMany({ filters, populate: REGISTRATION_POPULATE, sort: BY_ID, limit: MAX })).map(toRegistrationRow);
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
    athletes: async () => raws(await athletes().findMany({ populate: ['publicProfile'], sort: BY_ID, limit: MAX })).map(toAthleteRow),
    seasons: async () => raws(await strapi.documents(SEASON).findMany({ sort: BY_ID, limit: 1000 })).map((s): SeasonRow => ({
      id: text(s.documentId), label: text(s.label), startMonth: text(s.startMonth), endMonth: text(s.endMonth), isCurrent: s.isCurrent === true,
    })),
    sections: async () => raws(await strapi.documents(SECTION).findMany({ sort: BY_ID, limit: 1000 })).map((s): SectionRow => ({
      id: text(s.documentId), name: text(s.name), kind: s.kind === 'club' ? 'club' : 'school', publicPage: s.publicPage === true, order: typeof s.order === 'number' ? s.order : null,
    })),
    groups: async () => raws(await strapi.documents(GROUP).findMany({ populate: ['section'], sort: BY_ID, limit: 1000 })).map((g): GroupRow => ({
      id: text(g.documentId), name: text(g.name), sectionId: linkId(g.section), order: typeof g.order === 'number' ? g.order : null, active: g.active !== false,
    })),
  };
}

function rowReads(strapi: Core.Strapi): Pick<ClubStore, 'memberships' | 'acsRows' | 'duplicates' | 'profiles'> {
  const byAthlete = (athleteId?: string) => (athleteId ? { athlete: { documentId: athleteId } } : {});
  return {
    memberships: async (athleteId) => raws(await strapi.documents(MEMBERSHIP).findMany({ filters: byAthlete(athleteId), populate: LINKS, sort: BY_ID, limit: MAX })).map(toMembership),
    acsRows: async (athleteId) =>
      raws(await strapi.documents(ACS).findMany({ filters: byAthlete(athleteId), populate: ['athlete', 'season'], sort: BY_ID, limit: MAX })).map(toAcs),
    duplicates: async () =>
      raws(await strapi.documents(DUPLICATE).findMany({ populate: ['first', 'second'], sort: BY_ID, limit: MAX }))
        .map(toDuplicateRow)
        .filter((d) => d.firstId && d.secondId),
    profiles: async () =>
      toProfileRows(raws(await strapi.db.query(PROFILE).findMany({ select: ['documentId', 'name', 'slug', 'showPublicPage', 'publishedAt', 'previousSlugs'], orderBy: { id: 'asc' }, limit: MAX }))),
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

/** The link tables cascade, but `matchLevel` is a column: a match to a deleted athlete is cleared first. */
async function clearMatchesTo(strapi: Core.Strapi, athleteId: string): Promise<void> {
  const matched = raws(await strapi.documents(REGISTRATION).findMany({ filters: { matchAthlete: { documentId: athleteId } }, fields: ['documentId'], limit: MAX }));
  for (const r of matched) await strapi.documents(REGISTRATION).update({ documentId: text(r.documentId), data: { matchAthlete: null, matchLevel: null } });
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
      await clearMatchesTo(strapi, id);
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
    createDuplicate: async (firstId, secondId, dismissed = false) => {
      await strapi.documents(DUPLICATE).create({ data: { first: firstId, second: secondId, dismissed } });
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

const fileIdsOf = (v: unknown): number[] => (Array.isArray(v) ? v : [v]).map((f) => (f && typeof f === 'object' ? Number((f as Raw).id) : NaN)).filter(Number.isInteger);

/** The media attributes come from the profile schema, so a media field added later is covered too; its components hold no media. */
function profileMediaIds(strapi: Core.Strapi): ClubStore['profileMediaIds'] {
  return async (profileId) => {
    const fields = Object.entries(strapi.contentType(PROFILE).attributes).filter(([, a]) => a.type === 'media').map(([name]) => name);
    const populate = Object.fromEntries(fields.map((f) => [f, { select: ['id'] }]));
    const rows = raws(await strapi.db.query(PROFILE).findMany({ where: { documentId: profileId }, select: ['id'], populate }));
    return [...new Set(rows.flatMap((r) => fields.flatMap((f) => fileIdsOf(r[f]))))];
  };
}

type TextColumn = { table: string; column: string };
/** Custom fields are already resolved to their stored type here (Strapi converts them at load). */
const TEXT_TYPES: ReadonlySet<string> = new Set(['blocks', 'richtext', 'json', 'string', 'text']);
/** The file's own rows hold its hash and url and would always match; admin and users-permissions rows hold no content. */
const notScanned = (uid: string): boolean => uid === FILE || uid === 'plugin::upload.folder' || uid.startsWith('admin::') || uid.startsWith('plugin::users-permissions.');

/**
 * Every text-bearing column of every content type and component, from the registry so a field added later is covered: a blocks
 * image or an `imageUrl` string or markdown inside json can point at a file without a files_related_mph row.
 */
export function textColumns(strapi: Core.Strapi): TextColumn[] {
  const schemas: [string, { attributes: Record<string, { type: string }> }][] = [...Object.entries(strapi.contentTypes), ...Object.entries(strapi.components)];
  return schemas.filter(([uid]) => !notScanned(uid)).flatMap(([uid, schema]) => {
    const meta = strapi.db.metadata.get(uid);
    if (!meta) return [];
    return Object.entries(schema.attributes)
      .filter(([, a]) => TEXT_TYPES.has(a.type))
      .flatMap(([name]) => {
        const column = str((meta.attributes[name] as Raw | undefined)?.columnName);
        return column ? [{ table: meta.tableName, column }] : [];
      });
  });
}

const MATCH = "CAST(?? AS TEXT) LIKE '%' || ? || '%'";

/** One query per column, matching the file's hash (blocks images, format urls) or url (markdown, url strings). */
async function usedInText(strapi: Core.Strapi, file: Raw): Promise<boolean> {
  const needles = [str(file.hash), str(file.url)].filter((n): n is string => n !== null);
  if (!needles.length) return false;
  const sql = needles.map(() => MATCH).join(' OR ');
  for (const { table, column } of textColumns(strapi)) {
    if (await strapi.db.getConnection(table).whereRaw(sql, needles.flatMap((n) => [column, n])).first('id')) return true;
  }
  return false;
}

/** `related` is the upload plugin's morph relation (files_related_mph); populating it skips rows of deleted entries. */
function deleteMediaIfUnused(strapi: Core.Strapi): ClubStore['deleteMediaIfUnused'] {
  return async (fileId) => {
    const file = (await strapi.db.query(FILE).findOne({ where: { id: fileId }, populate: { related: { select: ['id'] } } })) as Raw | null;
    if (!file || raws(file.related).length > 0) return false;
    if (await usedInText(strapi, file)) return false;
    await strapi.plugin('upload').service('upload').remove(file);
    return true;
  };
}

type Scope = { transaction: ClubStore['transaction']; lockRow: (table: string, id: string) => Promise<void> };

/**
 * One transaction scope and the row locks taken inside it (a lock outside a transaction throws). A nested `transaction` reuses the outer one (Strapi), so
 * `active` is restored, not cleared, when it ends. The group store (src/club/groups/strapi-store.ts) builds its own scope with this.
 */
export function transactionScope(strapi: Core.Strapi): Scope {
  let active: Knex.Transaction | null = null;
  return {
    async transaction<T>(work: () => Promise<T>): Promise<T> {
      return await strapi.db.transaction(async ({ trx }: { trx: Knex.Transaction }) => {
        const outer = active;
        active = trx;
        try {
          return await work();
        } finally {
          active = outer;
        }
      });
    },
    lockRow: async (table, id) => {
      if (!active) throw new Error(`lock on ${table} taken outside a transaction`);
      await strapi.db.getConnection(table).transacting(active).forUpdate().where('document_id', id).select('id');
    },
  };
}

function transactions(strapi: Core.Strapi): Pick<ClubStore, 'transaction' | 'lockRegistration' | 'lockAthlete'> {
  const scope = transactionScope(strapi);
  return { transaction: scope.transaction, lockRegistration: (id) => scope.lockRow('registration_submissions', id), lockAthlete: (id) => scope.lockRow('athletes', id) };
}

/** `recipient` and `subject` name the parent and the child; `lastError` can echo the parent's e-mail (Brevo error body). */
const scrubbedJob = (status: unknown): Raw => ({ recipient: null, subject: null, lastError: null, status: scrubbedJobStatus(text(status)) });

/**
 * 3C reads and writes. Registration and e-mail job scrubs go through `db.query`: the document service refuses null on a
 * `required` attribute, the query engine does not, and the database lifecycles (the Înscrieri Sheet row) still run.
 */
function personalDataStore(strapi: Core.Strapi): Pick<ClubStore, 'registrationRecords' | 'anonymizedRegistrationIds' | 'setHistoryChanges' | 'scrubRegistration' | 'scrubEmailJobs'> {
  const query = (uid: typeof REGISTRATION | typeof JOB | typeof HISTORY) => strapi.db.query(uid);
  return {
    registrationRecords: async (athleteId) => raws(await query(REGISTRATION).findMany({ where: { athlete: { documentId: athleteId } }, orderBy: { id: 'asc' }, limit: MAX })),
    anonymizedRegistrationIds: async () =>
      raws(await query(REGISTRATION).findMany({ where: { athlete: { status: 'anonimizat' } }, select: ['documentId'], limit: MAX })).map((r) => text(r.documentId)),
    setHistoryChanges: async (seq, changes) => {
      await query(HISTORY).update({ where: { id: seq }, data: { changes } });
    },
    scrubRegistration: async (id, data) => {
      await query(REGISTRATION).update({ where: { documentId: id }, data });
    },
    scrubEmailJobs: async (registrationIds) => {
      if (!registrationIds.length) return;
      const jobs = raws(await query(JOB).findMany({ where: { registration: { documentId: { $in: registrationIds } } }, select: ['id', 'status'], limit: MAX }));
      for (const j of jobs) await query(JOB).update({ where: { id: j.id }, data: scrubbedJob(j.status) });
    },
  };
}

function settingsStore(strapi: Core.Strapi): Pick<ClubStore, 'personalDataSettings' | 'savePersonalDataSettings'> {
  const settings = () => strapi.documents(SETTINGS);
  return {
    personalDataSettings: async () => ((await settings().findFirst({})) as Raw | null)?.personalData ?? null,
    savePersonalDataSettings: async (value) => {
      const current = await settings().findFirst({});
      if (current) await settings().update({ documentId: current.documentId, data: { personalData: value } });
      else await settings().create({ data: { personalData: value } });
    },
  };
}

/** ClubStore on Strapi: document service for writes (validation, lifecycles), db queries for bulk reads. */
export function strapiClubStore(strapi: Core.Strapi): ClubStore {
  return {
    ...transactions(strapi),
    ...registrationReads(strapi),
    ...clubReads(strapi),
    ...rowReads(strapi),
    ...historyReads(strapi),
    ...athleteWrites(strapi),
    ...rowWrites(strapi),
    ...profileWrites(strapi),
    ...personalDataStore(strapi),
    ...settingsStore(strapi),
    profileMediaIds: profileMediaIds(strapi),
    deleteMediaIfUnused: deleteMediaIfUnused(strapi),
    moveHistory: async (from, to) => {
      await strapi.db.query(HISTORY).updateMany({ where: { subjectType: 'athlete', subjectId: from }, data: { subjectId: to } });
    },
    record: (entry) => recordHistory(strapi, entry),
  };
}
