import type { StartFacts } from '../new-season/facts';
import { G_GROUPS, G_SECTIONS, G_SEASONS, athleteRow, event, member } from './fake-group-store';

/** 2026-2027 current, 2027-2028 next; Filip in Intermediari Bronze (main) and Profesioniști, Ioana and Tudor (Inactiv) in Profesioniști, Ana in Intermediari Bronze. */
export const facts = (over: Partial<StartFacts> = {}): StartFacts => ({
  current: G_SEASONS[1], target: G_SEASONS[2], groups: G_GROUPS, sections: G_SECTIONS, today: '2027-09-15',
  athletes: [
    athleteRow({ id: 'a1', name: 'Filip Radu', birthDate: '2013-07-21' }), athleteRow({ id: 'a2', name: 'Ioana Marin' }),
    athleteRow({ id: 'a3', name: 'Tudor Matei', status: 'inactiv' }), athleteRow({ id: 'a4', name: 'Ana Ionescu' }), athleteRow({ id: 'a5', name: 'Sportiv anonimizat', status: 'anonimizat' }),
  ],
  memberships: [
    member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib', from: '2026-10-01' }), member({ id: 'm2', athleteId: 'a1', groupId: 'g-pro', isMain: false, from: '2026-10-15' }),
    member({ id: 'm3', athleteId: 'a2', groupId: 'g-pro' }), member({ id: 'm4', athleteId: 'a3', groupId: 'g-pro' }), member({ id: 'm5', athleteId: 'a4', groupId: 'g-ib' }),
    member({ id: 'm6', athleteId: 'a5', groupId: 'g-pro' }),
  ],
  events: [event({ id: 'e1' }), event({ id: 'e2', groupId: 'g-pro', type: 'curs', recurrence: { freq: 'weekly', days: ['tue', 'thu'], weekOfMonth: null, startTime: '18:00', endTime: '19:30', singleDate: null, seasonStart: '2026-10-01', seasonEnd: '2027-05-31' } })],
  ...over,
});
