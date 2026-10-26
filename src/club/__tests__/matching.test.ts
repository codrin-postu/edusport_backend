import { describe, expect, it } from 'vitest';
import { bestMatch, duplicateLevel, matchLevel, rankCandidates, registrationFacts, type AthleteFacts, type PersonFacts } from '../matching';

const child: PersonFacts = { name: 'Maria Dumitrescu', birthDate: '2016-03-14', phone: '0722 111 222', email: 'ana@example.com' };
const athlete = (over: Partial<AthleteFacts> = {}): AthleteFacts => ({
  id: 'a1', name: 'Maria Dumitrescu', birthDate: '2016-03-14', phone: null, email: null, updatedAt: '2026-10-01T10:00:00.000Z', ...over,
});

describe('levels (spec 2.1)', () => {
  it('Sigur: same name and same birth date, any order, one typo per word', () => {
    expect(matchLevel(child, athlete({ name: 'Dumitresu Maria' }))).toBe('sigur');
  });

  it('Probabil: same birth date, same phone or e-mail, one name word in common', () => {
    expect(matchLevel(child, athlete({ name: 'Maria Ionescu', phone: '+40722111222' }))).toBe('probabil');
    expect(matchLevel(child, athlete({ name: 'Maria Ionescu', email: ' ANA@example.com' }))).toBe('probabil');
  });

  it('not Probabil without a common name word (and not Alt copil: the birth date is the same)', () => {
    expect(matchLevel(child, athlete({ name: 'Ioana Ionescu', phone: '0722111222' }))).toBeNull();
  });

  it('Probabil: an athlete without a birth date and the same name (Open #2)', () => {
    expect(matchLevel(child, athlete({ name: 'dumitrescu maria', birthDate: null }))).toBe('probabil');
  });

  it('Alt copil: same phone or e-mail, other birth date', () => {
    expect(matchLevel(child, athlete({ name: 'Andrei Dumitrescu', birthDate: '2013-01-02', phone: '0722111222' }))).toBe('alt-copil');
  });

  it('nothing else matches', () => {
    expect(matchLevel(child, athlete({ name: 'Andrei Pop', birthDate: '2013-01-02' }))).toBeNull();
  });

  it('an unreadable registration date is never Sigur', () => {
    expect(matchLevel({ ...child, birthDate: null }, athlete())).toBeNull();
  });
});

describe('several candidates (gaps #15)', () => {
  const sigur = athlete({ id: 'old', updatedAt: '2026-01-01T00:00:00.000Z' });
  const probabilOld = athlete({ id: 'p1', name: 'Maria Ionescu', phone: '0722111222', updatedAt: '2026-02-01T00:00:00.000Z' });
  const probabilNew = athlete({ id: 'p2', name: 'Maria Popescu', email: 'ana@example.com', updatedAt: '2026-09-01T00:00:00.000Z' });
  const sibling = athlete({ id: 's', name: 'Andrei Dumitrescu', birthDate: '2013-01-02', phone: '0722111222' });

  it('highest level first, then the most recently updated; Alt copil never listed', () => {
    expect(rankCandidates(child, [probabilOld, sibling, sigur, probabilNew])).toEqual([
      { athleteId: 'old', level: 'sigur' },
      { athleteId: 'p2', level: 'probabil' },
      { athleteId: 'p1', level: 'probabil' },
    ]);
    expect(bestMatch(child, [sibling])).toBeNull();
  });
});

describe('registrationFacts', () => {
  it('reads the free-text birth date as ISO, null when unreadable', () => {
    expect(registrationFacts({ childName: 'Maria', childBirthDate: '14 martie 2016', phone: '1', email: 'e' }).birthDate).toBe('2016-03-14');
    expect(registrationFacts({ childName: 'Maria', childBirthDate: 'ieri' }).birthDate).toBeNull();
  });
});

describe('possible duplicates between athletes (spec 2.3)', () => {
  it('flags Sigur and Probabil pairs', () => {
    expect(duplicateLevel(athlete(), athlete({ id: 'b' }))).toBe('sigur');
  });

  it('flags a pair where either side has no birth date and the names agree', () => {
    expect(duplicateLevel(athlete({ birthDate: null }), athlete({ id: 'b' }))).toBe('probabil');
    expect(duplicateLevel(athlete(), athlete({ id: 'b', birthDate: null }))).toBe('probabil');
  });

  it('leaves siblings alone', () => {
    expect(duplicateLevel(athlete({ phone: '1' }), athlete({ id: 'b', name: 'Andrei Dumitrescu', birthDate: '2013-01-02', phone: '1' }))).toBeNull();
  });
});
