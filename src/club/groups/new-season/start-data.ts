import { listLine } from '../program-text';
import { ageOnIso } from '../season-pick';
import { byGroupOrder, orderedSections, sectionLabel } from '../sections';
import { seriesText } from '../series';
import type { GroupRecord } from '../types';
import { currentMembersOf, runningAtEnd, seasonEndOf, seriesStart, targetSeriesOf, type StartFacts } from './facts';

/** Step 2 of the window (10.2): per section, the active groups with members, program and the default ticks. Pure. */
export type StartAthlete = { athleteId: string; name: string; age: number | null; inactive: boolean; currentMainGroupId: string | null };
export type StartGroup = {
  groupId: string; name: string; members: number; inactive: number; program: string; programState: 'ok' | 'none' | 'exists';
  defaultMembers: boolean; defaultProgram: boolean; athletes: StartAthlete[];
};
export type StartSection = { sectionId: string; label: string; groups: StartGroup[] };
export type StartData = {
  current: { documentId: string; label: string }; target: { documentId: string; label: string; fee: number | null };
  seriesFrom: string; seriesTo: string; sections: StartSection[];
};

function athletesOf(f: StartFacts, groupId: string): StartAthlete[] {
  return currentMembersOf(f, groupId)
    .map((m) => ({ m, a: f.athletes.find((x) => x.id === m.athleteId) }))
    .filter(({ a }) => !!a && a.status !== 'anonimizat')
    .map(({ m, a }) => ({
      athleteId: m.athleteId, name: a?.name ?? '', age: ageOnIso(a?.birthDate ?? null, f.today), inactive: a?.status === 'inactiv',
      currentMainGroupId: f.memberships.find((r) => r.athleteId === m.athleteId && r.seasonId === f.current.id && r.isMain && !r.to)?.groupId ?? null,
    }))
    .sort((x, y) => x.name.localeCompare(y.name, 'ro'));
}

function groupRow(f: StartFacts, g: GroupRecord, kind: 'school' | 'club'): StartGroup {
  const athletes = athletesOf(f, g.id);
  const running = runningAtEnd(f, g.id);
  const programState = targetSeriesOf(f, g.id).length ? 'exists' : running.length ? 'ok' : 'none';
  return {
    groupId: g.id, name: g.name, members: athletes.length, inactive: athletes.filter((a) => a.inactive).length,
    program: running.map((s) => listLine(seriesText(s))).join(', '), programState,
    defaultMembers: kind === 'club' && athletes.length > 0, defaultProgram: programState === 'ok', athletes,
  };
}

export function startData(f: StartFacts): StartData {
  const sections = orderedSections(f.sections).map((s) => ({
    sectionId: s.id, label: sectionLabel(s, f.sections),
    groups: f.groups.filter((g) => g.active && g.sectionId === s.id).sort(byGroupOrder).map((g) => groupRow(f, g, s.kind)),
  }));
  return {
    current: { documentId: f.current.id, label: f.current.label }, target: { documentId: f.target.id, label: f.target.label, fee: f.target.membershipFee },
    seriesFrom: seriesStart(f), seriesTo: seasonEndOf(f.target), sections: sections.filter((s) => s.groups.length > 0),
  };
}
