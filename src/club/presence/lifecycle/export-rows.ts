import type { SummaryPresence } from '../../personal-data/summary-model';
import { PURPOSE_WORDS } from '../copy/core';
import { attendanceLine, lessonLine, paymentLine, subscriptionLine } from '../copy/lifecycle';
import { monthName } from '../dates';
import type { PresenceStore } from '../store';
import { subscriptionState, usedSlots } from '../subscriptions';
import type { AttendanceRow, LessonRow, PaymentRow, SessionRow, SubscriptionRow } from '../types';

export type PresenceExportFacts = {
  attendances: AttendanceRow[]; sessions: SessionRow[]; lessons: LessonRow[]; subscriptions: SubscriptionRow[]; used: Map<string, number>;
  payments: PaymentRow[]; groups: readonly { id: string; name: string }[]; coaches: readonly { id: string; name: string }[]; seasons: readonly { id: string; label: string }[];
};

/** Only this child's rows. A session is read for its own date, time and group; who else attended it is never read (3C decision 1). */
export async function loadPresenceExportFacts(presence: PresenceStore, athleteId: string): Promise<PresenceExportFacts> {
  const [attendances, lessons, subscriptions, payments, groups, coaches, seasons] = await Promise.all([
    presence.attendances({ athleteId }), presence.lessons({ athleteId }), presence.subscriptions({ athleteId }), presence.payments({ athleteId }),
    presence.groups(), presence.teamMembers(), presence.seasons(),
  ]);
  const sessionIds = [...new Set(attendances.map((a) => a.sessionId))];
  const subscriptionIds = subscriptions.map((s) => s.id);
  const [sessions, own] = await Promise.all([
    sessionIds.length ? presence.sessions({ ids: sessionIds }) : [],
    subscriptionIds.length ? presence.attendances({ athleteId, subscriptionIds }) : [],
  ]);
  return { attendances, sessions, lessons, subscriptions, used: usedSlots(own), payments, groups, coaches, seasons };
}

/** "Pentru" text of a payment (decided 11). */
export function paymentPurposeText(p: PaymentRow, f: Pick<PresenceExportFacts, 'subscriptions' | 'seasons'>): string {
  if (p.purpose === 'abonament') return f.subscriptions.find((s) => s.id === p.subscriptionId)?.itemName ?? PURPOSE_WORDS.abonament;
  if (p.purpose === 'cotizatie') return `${PURPOSE_WORDS.cotizatie} ${f.seasons.find((s) => s.id === p.seasonId)?.label ?? ''}`.trim();
  if (p.purpose === 'club_luna' && p.clubMonth) return `${PURPOSE_WORDS.club_luna}, ${monthName(p.clubMonth)} ${p.clubMonth.slice(0, 4)}`;
  return PURPOSE_WORDS[p.purpose];
}

const newestFirst = <T>(rows: T[], key: (r: T) => string): T[] => [...rows].sort((a, b) => key(b).localeCompare(key(a)));
const nameOf = (list: readonly { id: string; name: string }[], id: string): string => list.find((x) => x.id === id)?.name ?? '';

function attendanceLines(f: PresenceExportFacts): string[] {
  const lines = f.attendances.flatMap((a) => {
    const session = f.sessions.find((s) => s.id === a.sessionId);
    return session ? [{ key: `${session.date} ${session.startTime}`, text: attendanceLine({
      date: session.date, groupName: nameOf(f.groups, session.groupId), startTime: session.startTime, grup: a.grup, uscat: a.uscat, visitor: a.visitor,
    }) }] : [];
  });
  return newestFirst(lines, (l) => l.key).map((l) => l.text);
}

const lessonLines = (f: PresenceExportFacts): string[] =>
  newestFirst(f.lessons, (l) => `${l.date} ${l.startTime}`).map((l) => lessonLine({
    date: l.date, startTime: l.startTime, durationMin: l.durationMin, coachNames: l.coachIds.map((id) => nameOf(f.coaches, id)).filter(Boolean),
    present: l.present, price: l.price,
  }));

const subscriptionLines = (f: PresenceExportFacts, today: string): string[] =>
  newestFirst(f.subscriptions, (s) => s.startsOn).map((s) => {
    const used = f.used.get(s.id) ?? 0;
    return subscriptionLine({ itemName: s.itemName, startsOn: s.startsOn, validUntil: s.validUntil, used, slots: s.slots, state: subscriptionState(s, used, today), price: s.price });
  });

const paymentLines = (f: PresenceExportFacts): string[] =>
  newestFirst(f.payments, (p) => `${p.paidOn} ${p.recordedAt}`).map((p) => paymentLine({
    paidOn: p.paidOn, amount: p.amount, method: p.method, purposeText: paymentPurposeText(p, f), collectedAtRink: p.collectedAtRink, note: p.note, cancelled: p.cancelled,
  }));

/** The four phase 5 sections of "rezumat.pdf" as lines, newest first; a cancelled payment is kept and marked (4.21a). */
export const presenceSummary = (f: PresenceExportFacts, today: string): SummaryPresence => ({
  attendance: attendanceLines(f), lessons: lessonLines(f), subscriptions: subscriptionLines(f, today), payments: paymentLines(f),
});
