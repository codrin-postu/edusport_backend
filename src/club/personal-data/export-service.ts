import { guarded, refuse, type AdminResult } from '../admin-result';
import { registrationSeasonLabel } from '../athletes/cards';
import { ADMIN_ERRORS } from '../athletes/errors';
import { readHistoryEntries } from '../athletes/history-read';
import { safely } from '../athletes/matches';
import type { AcsRow, AthleteRow, ClubStore, GroupRow, MembershipRow, RegistrationRow, SeasonRow, SectionRow, ServiceContext } from '../athletes/store';
import type { DocumentKind } from '../documents/types';
import { isoDate } from '../birth-date';
import { loadPresenceExportFacts, presenceSummary } from '../presence/lifecycle/export-rows';
import type { PresenceStore } from '../presence/store';
import { HISTORY_ACTIONS, SUBJECT, actorLabel } from '../history-text';
import { isScriptFormRegistration, registrationDocumentKinds } from '../registration-panel';
import { isAnonymized } from './anonymize-plan';
import { carriedNames } from './carried-names';
import { exportFileName, zipExport, type ZipEntry } from './export-zip';
import { buildSummaryModel, type SummaryInput, type SummaryRegistration } from './summary-model';
import { renderSummaryPdf } from './summary-pdf';

export type ExportDocument = { kind: DocumentKind; fileName: string; data: Uint8Array };
export type ExportContext = ServiceContext & { storedDocuments: (registrationId: string) => Promise<ExportDocument[]>; now: () => Date; presence: PresenceStore };
export type ExportFile = { fileName: string; data: Uint8Array };

type Facts = {
  seasons: SeasonRow[]; groups: GroupRow[]; sections: SectionRow[]; memberships: MembershipRow[]; acs: AcsRow[];
  registrations: RegistrationRow[]; records: Record<string, unknown>[];
};

async function loadFacts(store: ClubStore, id: string): Promise<Facts> {
  const [seasons, groups, sections, memberships, acs, registrations, records] = await Promise.all([
    store.seasons(), store.groups(), store.sections(), store.memberships(id), store.acsRows(id), store.registrations({ athleteId: id }), store.registrationRecords(id),
  ]);
  return { seasons, groups, sections, memberships, acs, registrations, records };
}

const labelOf = (seasons: SeasonRow[], id: string): string => seasons.find((s) => s.id === id)?.label ?? '';
const newestFirst = <T extends { season: string }>(rows: T[]): T[] => [...rows].sort((a, b) => b.season.localeCompare(a.season));

const groupLines = (f: Facts): SummaryInput['groups'] =>
  newestFirst(f.memberships.map((m) => ({ season: labelOf(f.seasons, m.seasonId), group: f.groups.find((g) => g.id === m.groupId)?.name ?? '', main: m.isMain })));
const acsLines = (f: Facts): SummaryInput['acs'] => newestFirst(f.acs.map((r) => ({ season: labelOf(f.seasons, r.seasonId), state: r.state })));

/** The PDFs a registration should have; none for an old registration from before the phase 2 form. */
const expectedKinds = (record: Record<string, unknown>): DocumentKind[] => (isScriptFormRegistration(record) ? registrationDocumentKinds(record) : []);

type Loaded = { registrations: SummaryRegistration[]; entries: ZipEntry[] };

async function loadRegistrations(ctx: ExportContext, f: Facts): Promise<Loaded> {
  const out: Loaded = { registrations: [], entries: [] };
  for (const r of f.registrations) {
    const record = f.records.find((x) => x.documentId === r.id) ?? {};
    const docs = await ctx.storedDocuments(r.id);
    out.entries.push(...docs.map((d) => ({ folder: r.number ?? r.id, fileName: d.fileName, data: d.data })));
    out.registrations.push({
      number: r.number ?? '', record, seasonLabel: registrationSeasonLabel(r, f.seasons), sectionName: f.sections.find((s) => s.id === r.sectionId)?.name ?? null,
      missingDocuments: expectedKinds(record).filter((kind) => !docs.some((d) => d.kind === kind)),
    });
  }
  return out;
}

async function historyLines(store: ClubStore, athleteId: string, registrations: RegistrationRow[]): Promise<SummaryInput['history']> {
  const own = (await readHistoryEntries(store, SUBJECT.athlete, athleteId)).map((l) => ({ ...l, subject: '' }));
  const regs = await Promise.all(registrations.map(async (r) =>
    (await readHistoryEntries(store, SUBJECT.registration, r.id, r.submittedAt)).map((l) => ({ ...l, subject: r.number ?? '' }))));
  return [...own, ...regs.flat()].sort((a, b) => b.at.localeCompare(a.at));
}

async function buildExport(ctx: ExportContext, athlete: AthleteRow): Promise<AdminResult<ExportFile>> {
  const facts = await loadFacts(ctx.store, athlete.id);
  const loaded = await loadRegistrations(ctx, facts);
  const names = await ctx.store.adminNames([ctx.actor]);
  const now = ctx.now();
  const model = buildSummaryModel({
    athlete, groups: groupLines(facts), acs: acsLines(facts), registrations: loaded.registrations,
    history: await historyLines(ctx.store, athlete.id, facts.registrations), childNames: await carriedNames(ctx.store, athlete, facts.registrations),
    presence: presenceSummary(await loadPresenceExportFacts(ctx.presence, athlete.id), isoDate(ctx.today)),
    generatedAt: now, generatedBy: actorLabel(ctx.actor, names),
  });
  const summary = await renderSummaryPdf(model);
  return { ok: true, data: { fileName: exportFileName(athlete.name, now), data: zipExport(summary, loaded.entries) } };
}

/** "Exportă datele" (spec 3), any admin. The history line is written after the ZIP is built; its failure is only logged. */
export async function exportAthleteData(ctx: ExportContext, id: string): Promise<AdminResult<ExportFile>> {
  const athlete = await ctx.store.athlete(id);
  if (!athlete || isAnonymized(athlete)) return refuse(404, ADMIN_ERRORS.notFound);
  const built = await guarded(ctx.log, `[personal-data] exporting ${id}`, () => buildExport(ctx, athlete));
  if (built.ok === true) {
    const entry = { subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.dataExported, actor: ctx.actor };
    await safely(() => ctx.store.record(entry), ctx.log, `export history of ${id}`);
  }
  return built;
}
