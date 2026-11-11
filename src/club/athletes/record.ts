import { guarded, refuse, type AdminResult, type FieldChange } from '../admin-result';
import {
  athleteChanges, birthDateForPicker, isAthleteField, isDataIncomplete, missingFields, pickAthleteValues, readAthleteInput, type AthleteField, type AthleteValues,
} from '../athlete-data';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { isAnonymized } from '../personal-data/anonymize-plan';
import { DOCUMENT_LABELS, registrationDocumentKinds } from '../registration-panel';
import type { AthleteEditResponse, AthleteRecord } from './api-types';
import { registrationSeasonLabel } from './cards';
import { ADMIN_ERRORS } from './errors';
import { moveOnEmailChange } from '../portal/access/lifecycle';
import { readHistory } from './history-read';
import { refreshAllMatches, safely } from './matches';
import type { AcsRow, AthleteRow, ClubStore, DuplicateRow, GroupRow, MembershipRow, ProfileRow, RegistrationRow, SeasonRow, ServiceContext } from './store';
import { isCurrentMembership } from '../group-membership';

/** The athlete record (spec 6): Date | Profil public | Documente | Istoric, read in one call. */
type RecordSource = {
  seasons: SeasonRow[]; groups: GroupRow[]; memberships: MembershipRow[]; acs: AcsRow[]; registrations: RegistrationRow[];
  profiles: ProfileRow[]; duplicates: DuplicateRow[]; athletes: AthleteRow[]; historyCount: number; season: SeasonRow | null;
};

function mainGroupName(src: RecordSource): string | null {
  const main = src.memberships.find((m) => m.seasonId === src.season?.id && m.isMain && isCurrentMembership(m));
  return src.groups.find((g) => g.id === main?.groupId)?.name ?? null;
}

function registrationRows(src: RecordSource): AthleteRecord['registrations'] {
  return [...src.registrations]
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
    .map((r) => ({ documentId: r.id, number: r.number, season: registrationSeasonLabel(r, src.seasons), status: r.status }));
}

/** "Acord <sezon> (înscrierea <nr>)", "Cerere de adeziune <sezon> (înscrierea <nr>)" (gaps #11). */
function documentRows(src: RecordSource): AthleteRecord['documents'] {
  return registrationRows(src).flatMap((row) => {
    const reg = src.registrations.find((r) => r.id === row.documentId);
    return registrationDocumentKinds({ membershipAnswer: reg?.membershipAnswer }).map((kind) => ({
      registrationDocumentId: row.documentId,
      kind,
      label: `${[DOCUMENT_LABELS[kind], row.season].filter(Boolean).join(' ')} (înscrierea ${row.number ?? ''})`,
    }));
  });
}

/** A dismissed pair ("Nu e același copil") never shows again (gaps context: dismissed pairs are store-kept, UI-hidden). */
function duplicateRows(athleteId: string, src: RecordSource): AthleteRecord['duplicates'] {
  return src.duplicates
    .filter((d) => !d.dismissed && (d.firstId === athleteId || d.secondId === athleteId))
    .flatMap((d) => {
      const other = src.athletes.find((a) => a.id === (d.firstId === athleteId ? d.secondId : d.firstId));
      return other ? [{ pairId: d.id, documentId: other.id, name: other.name ?? '' }] : [];
    });
}

function assemble(a: AthleteRow, src: RecordSource): AthleteRecord {
  const profile = src.profiles.find((p) => p.id === a.profileId);
  const values = pickAthleteValues(a);
  const anonymized = isAnonymized(a);
  return {
    documentId: a.id,
    fields: { ...values, birthDate: birthDateForPicker(a.birthDate) },
    missing: anonymized ? [] : missingFields(values),
    status: a.status,
    dataIncomplete: !anonymized && (a.dataIncomplete || isDataIncomplete(values)),
    header: { birthDate: birthDateForPicker(a.birthDate), mainGroup: mainGroupName(src) },
    season: src.season ? { documentId: src.season.id, label: src.season.label } : null,
    acs: { seasonLabel: src.season?.label ?? null, state: src.acs.find((r) => r.seasonId === src.season?.id)?.state ?? 'nu' },
    registrations: registrationRows(src),
    documents: anonymized ? [] : documentRows(src),
    profile: profile ? { documentId: profile.id, slug: profile.slug, showPublicPage: profile.showPublicPage } : null,
    duplicates: duplicateRows(a.id, src),
    historyCount: src.historyCount,
  };
}

export async function readAthleteRecord(store: ClubStore, id: string, seasonId: string | null): Promise<AthleteRecord | null> {
  const athlete = await store.athlete(id);
  if (!athlete) return null;
  const [seasons, groups, memberships, acs, registrations, profiles, duplicates, athletes, history] = await Promise.all([
    store.seasons(), store.groups(), store.memberships(id), store.acsRows(id), store.registrations({ athleteId: id }),
    store.profiles(), store.duplicates(), store.athletes(), readHistory(store, SUBJECT.athlete, id),
  ]);
  const season = seasons.find((s) => s.id === seasonId) ?? seasons.find((s) => s.isCurrent) ?? null;
  return assemble(athlete, { seasons, groups, memberships, acs, registrations, profiles, duplicates, athletes, historyCount: history.length, season });
}

/** "Date incomplete" is recomputed on every save (3b Q20), even when no field changed. Runs inside the caller's lock. */
async function saveEdit(ctx: ServiceContext, athlete: AthleteRow, values: AthleteValues, changes: Record<string, FieldChange>): Promise<void> {
  const dataIncomplete = isDataIncomplete(values);
  if (Object.keys(changes).length === 0) {
    if (athlete.dataIncomplete !== dataIncomplete) await ctx.store.updateAthlete(athlete.id, { dataIncomplete });
    return;
  }
  await ctx.store.updateAthlete(athlete.id, { ...values, dataIncomplete });
  if ('name' in changes && athlete.profileId && values.name) await ctx.store.renameProfile(athlete.profileId, values.name);
  await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: athlete.id, action: HISTORY_ACTIONS.updated, changes: { fields: changes }, actor: ctx.actor });
}

/** Locked and re-read inside the transaction, so a concurrent anonymize is seen (fix round 1, important #2). */
async function updateInTransaction(ctx: ServiceContext, id: string, values: AthleteValues): Promise<AdminResult<{ changed: AthleteField[]; jobIds: string[] }>> {
  await ctx.store.lockAthlete(id);
  const athlete = await ctx.store.athlete(id);
  if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);
  if (isAnonymized(athlete)) return refuse(409, ADMIN_ERRORS.stale);
  const changes = athleteChanges(pickAthleteValues(athlete), values);
  // The access follows the e-mail (spec 4.4); a refusal (a disabled account owns the new address) comes before any write, so the edit is refused whole.
  const moved = ctx.access && 'email' in changes ? await moveOnEmailChange(ctx.access, id, athlete.email, values.email) : null;
  if (moved && moved.ok === false) return moved;
  await saveEdit(ctx, athlete, values, changes);
  return { ok: true, data: { changed: Object.keys(changes).filter(isAthleteField), jobIds: moved?.ok === true ? moved.data.jobIds : [] } };
}

/** PUT /api/club/athletes/:documentId ("Editează" on Date, spec 6.2). A name change renames the profile (3b s2). */
export async function updateAthlete(ctx: ServiceContext, id: string, body: unknown): Promise<AdminResult<AthleteEditResponse>> {
  const input = readAthleteInput(body, 'edit');
  if (input.ok === false) return refuse(400, input.error);
  const written = await guarded(ctx.log, `[athletes] editing ${id}`, async () => {
    try {
      return await ctx.store.transaction(() => updateInTransaction(ctx, id, input.values));
    } catch (err) {
      // Two edits moving two athletes to one new address: the loser of the unique index (or a lock cycle) is stale, not a failure.
      const code = (err as { code?: unknown } | null)?.code;
      if (code === '23505' || code === '40P01') return refuse(409, ADMIN_ERRORS.stale);
      throw err;
    }
  });
  if (written.ok === false) return written;
  for (const jobId of written.data.jobIds) ctx.access?.afterCommit(jobId);
  if (written.data.changed.length > 0) await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after an athlete edit');
  const record = await readAthleteRecord(ctx.store, id, null);
  return record ? { ok: true, data: { record, changed: written.data.changed } } : refuse(404, ADMIN_ERRORS.notFound);
}
