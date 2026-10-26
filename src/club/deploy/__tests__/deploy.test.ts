import { describe, expect, it } from 'vitest';
import { planAthletes } from '../../migrate/plan';
import { planDeployStatus } from '../deploy-status';
import { planDuplicateFlags } from '../duplicate-flags';
import { planNameMigration } from '../name-migration';
import { planPastRegistrationAthletes, type PastRegistration } from '../past-registrations';

describe('step 7: one name (spec 1.1)', () => {
  it('joins first and last, collapses spaces, skips named rows, reports empty rows and profile mismatches (N7)', () => {
    const plan = planNameMigration([
      { id: 'a1', name: null, firstName: 'Ana  Maria', lastName: 'Pop', profileName: 'Ana Maria Pop' },
      { id: 'a2', name: 'Ion Ilie', firstName: 'Ion', lastName: 'Ilie', profileName: null },
      { id: 'a3', name: null, firstName: '', lastName: null, profileName: null },
      { id: 'a4', name: null, firstName: 'Luca', lastName: 'Stoica', profileName: 'Luca Andrei Stoica' },
    ]);
    expect(plan.updates).toEqual([{ id: 'a1', name: 'Ana Maria Pop' }, { id: 'a4', name: 'Luca Stoica' }]);
    expect(plan.empty).toEqual(['a3']);
    expect(plan.profileMismatches).toEqual([{ id: 'a4', name: 'Luca Stoica', profileName: 'Luca Andrei Stoica' }]);
  });
});

describe('step 8: athletes for profiles without one (3b Q33)', () => {
  it('writes the full name', () => {
    expect(planAthletes({ sportspeople: [{ documentId: 'p1', name: ' Maria  Dumitrescu' }, { documentId: 'p2', name: 'Ana' }], linkedProfileIds: ['p2'] }).create).toEqual([
      { name: 'Maria Dumitrescu', publicProfileId: 'p1', dataIncomplete: true },
    ]);
  });
});

const past = (over: Partial<PastRegistration> & { id: string }): PastRegistration => ({
  athleteId: null, number: null, childName: 'Luca Stoica', childBirthDate: '01.02.2015', parentName: 'Ion Stoica', phone: '0722000001', email: 'ion@example.com',
  status: 'Nou', seasonLabel: '2025-2026', submittedAt: '2025-10-01T10:00:00.000Z', ...over,
});

describe('step 9: athletes from past registrations (d17, Open #1)', () => {
  it('one athlete per child across seasons; newest contact and name as written win', () => {
    const plan = planPastRegistrationAthletes([
      past({ id: 'r1', seasonLabel: '2024-2025', submittedAt: '2024-10-01T10:00:00.000Z' }),
      past({ id: 'r2', childName: 'Stoica Luca', phone: '0722000009', parentName: 'Ana Stoica', submittedAt: '2025-10-05T10:00:00.000Z' }),
    ], '2026-2027', new Set());
    expect(plan.create).toEqual([{
      values: { name: 'Stoica Luca', birthDate: '2015-02-01', contactName: 'Ana Stoica', phone: '0722000009', email: 'ion@example.com' },
      registrations: [{ documentId: 'r1', season: '2024-2025', number: null }, { documentId: 'r2', season: '2025-2026', number: null }],
    }]);
  });

  it('twins with names one letter apart stay two athletes and are flagged as possible duplicates', () => {
    const plan = planPastRegistrationAthletes([
      past({ id: 'r1', childName: 'Daniel Pop', seasonLabel: '2024-2025' }),
      past({ id: 'r2', childName: 'Daniela Pop', seasonLabel: '2024-2025' }),
      past({ id: 'r3', childName: 'Daniel Pop' }),
      past({ id: 'r4', childName: 'Daniela Pop' }),
    ], '2026-2027', new Set());
    expect(plan.create.map((a) => [a.values.name, a.registrations.map((r) => r.documentId)])).toEqual([
      ['Daniel Pop', ['r1', 'r3']],
      ['Daniela Pop', ['r2', 'r4']],
    ]);
    const athletes = plan.create.map((a, i) => ({ id: `a${i}`, name: a.values.name ?? '', birthDate: a.values.birthDate, phone: a.values.phone, email: a.values.email }));
    expect(planDuplicateFlags(athletes, [])).toEqual([{ firstId: 'a0', secondId: 'a1', level: 'probabil' }]);
  });

  it('the latest season wins even when its registration has no submission time', () => {
    const plan = planPastRegistrationAthletes([
      past({ id: 'r2', parentName: 'Ana Stoica', submittedAt: null }),
      past({ id: 'r1', seasonLabel: '2024-2025', submittedAt: '2024-10-01T10:00:00.000Z' }),
    ], '2026-2027', new Set());
    expect(plan.create[0].values.contactName).toBe('Ana Stoica');
    expect(plan.create[0].registrations.map((r) => r.documentId)).toEqual(['r1', 'r2']);
  });

  it('each contact field is the newest non-empty one', () => {
    const plan = planPastRegistrationAthletes([
      past({ id: 'r1', seasonLabel: '2023-2024', email: 'vechi@example.com' }),
      past({ id: 'r2', seasonLabel: '2024-2025', phone: '0722000002', email: '' }),
      past({ id: 'r3', parentName: 'Ana Stoica', phone: ' ', email: '' }),
    ], '2026-2027', new Set());
    expect(plan.create[0].values).toEqual({ name: 'Luca Stoica', birthDate: '2015-02-01', contactName: 'Ana Stoica', phone: '0722000002', email: 'vechi@example.com' });
  });

  it('skips Respins, the current season, registrations with no season, those already used and those already linked', () => {
    const plan = planPastRegistrationAthletes([
      past({ id: 'r1', status: 'Respins' }),
      past({ id: 'r2', seasonLabel: '2026-2027' }),
      past({ id: 'r3', seasonLabel: null }),
      past({ id: 'r4' }),
      past({ id: 'r5', athleteId: 'a1' }),
    ], '2026-2027', new Set(['r4']));
    expect(plan).toEqual({ create: [], skipped: { covered: 1, linked: 1, respins: 1, noSeason: 1, currentOrLater: 1 } });
  });

  it('an unreadable birth date forms its own athlete without a date', () => {
    const plan = planPastRegistrationAthletes([past({ id: 'r1', childBirthDate: 'ieri' }), past({ id: 'r2' })], '2026-2027', new Set());
    expect(plan.create.map((a) => [a.values.birthDate, a.registrations.length])).toEqual([[null, 1], ['2015-02-01', 1]]);
  });
});

describe('step 11: possible duplicates (spec 2.3)', () => {
  it('flags each pair once and skips pairs already flagged, in either order', () => {
    const athletes = [
      { id: 'a', name: 'Maria Pop', birthDate: null, phone: null, email: null },
      { id: 'b', name: 'Pop Maria', birthDate: '2016-03-14', phone: null, email: null },
      { id: 'c', name: 'Maria Pop', birthDate: '2016-03-14', phone: null, email: null },
      { id: 'd', name: 'Ion Ilie', birthDate: '2016-03-14', phone: null, email: null },
    ];
    expect(planDuplicateFlags(athletes, [{ firstId: 'c', secondId: 'a' }])).toEqual([
      { firstId: 'a', secondId: 'b', level: 'probabil' },
      { firstId: 'b', secondId: 'c', level: 'sigur' },
    ]);
  });

  it('never flags again a pair the admin dismissed with "Nu e același copil"', () => {
    const athletes = [
      { id: 'a', name: 'Maria Pop', birthDate: '2016-03-14', phone: null, email: null },
      { id: 'b', name: 'Maria Pop', birthDate: '2016-03-14', phone: null, email: null },
    ];
    expect(planDuplicateFlags(athletes, [])).toHaveLength(1);
    expect(planDuplicateFlags(athletes, [{ firstId: 'b', secondId: 'a' }])).toEqual([]);
  });

  it('a public-profile athlete and a past-registration athlete with the same name are flagged, never merged', () => {
    const [profile] = planAthletes({ sportspeople: [{ documentId: 'p1', name: 'Luca Stoica' }], linkedProfileIds: [] }).create;
    const [fromPast] = planPastRegistrationAthletes([past({ id: 'r1' })], '2026-2027', new Set()).create;
    const profileFacts = { id: 'prof', name: profile.name, birthDate: null, phone: null, email: null };
    const pastFacts = { id: 'past', name: fromPast.values.name ?? '', birthDate: fromPast.values.birthDate, phone: fromPast.values.phone, email: fromPast.values.email };
    expect(planDuplicateFlags([profileFacts, pastFacts], [])).toEqual([{ firstId: 'prof', secondId: 'past', level: 'probabil' }]);
    expect(planDuplicateFlags([pastFacts, profileFacts], [])).toEqual([{ firstId: 'past', secondId: 'prof', level: 'probabil' }]);
  });
});

describe('step 12: status at deploy (3b s6, gaps #18)', () => {
  it('Activ if registered this season (linked or Sigur, not Respins) or with the page on; all others Inactiv; unchanged rows left out', () => {
    const changes = planDeployStatus(
      [
        { id: 'linked', status: 'inactiv', profileId: null },
        { id: 'sigur', status: 'activ', profileId: null },
        { id: 'probabil', status: 'activ', profileId: null },
        { id: 'public', status: 'activ', profileId: 'sp1' },
        { id: 'hidden', status: 'activ', profileId: 'sp2' },
        { id: 'rejected', status: 'activ', profileId: null },
      ],
      [
        { status: 'Nou', athleteId: 'linked', matchAthleteId: null, matchLevel: null },
        { status: 'Nou', athleteId: null, matchAthleteId: 'sigur', matchLevel: 'sigur' },
        { status: 'Nou', athleteId: null, matchAthleteId: 'probabil', matchLevel: 'probabil' },
        { status: 'Respins', athleteId: 'rejected', matchAthleteId: null, matchLevel: null },
        { status: 'Respins', athleteId: null, matchAthleteId: 'rejected', matchLevel: 'sigur' },
      ],
      new Set(['sp1']),
    );
    expect(changes).toEqual([
      { id: 'linked', from: 'inactiv', to: 'activ' },
      { id: 'probabil', from: 'activ', to: 'inactiv' },
      { id: 'hidden', from: 'activ', to: 'inactiv' },
      { id: 'rejected', from: 'activ', to: 'inactiv' },
    ]);
  });
});
