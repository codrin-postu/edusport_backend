import { describe, expect, it } from 'vitest';
import { REGISTRY, SENSITIVE_BUILTIN_KEYS, questionMap } from '../registry';
import {
  LAST_SEASON_OPTIONS,
  MEMBERSHIP_OPTIONS,
  RELATIONSHIP_OPTIONS,
  RELATIONSHIP_OTHER_LABEL,
  SOURCE_OPTIONS,
  SOURCE_OTHER_LABEL,
} from '../../../club/registration-form-options';

const q = questionMap('inscriere');
const pairs = (list: readonly { value: string; label: string }[]) => list.map((o) => ({ value: o.value, label: o.label }));
const same = (list: readonly string[]) => list.map((v) => ({ value: v, label: v }));

describe('registry inscriere (script form)', () => {
  it('has the 3 approved steps with the script form questions in order', () => {
    expect(REGISTRY.inscriere.steps.map((s) => [s.key, s.title, s.questions.map((x) => x.key)])).toEqual([
      [
        'date',
        'Date înscriere',
        ['email', 'parentName', 'relationship', 'relationshipOther', 'phone', 'childName', 'childBirthDate',
          'childHeight', 'shirtSize', 'lastSeason', 'priorExperience', 'expectations'],
      ],
      ['abonament', 'Abonament', ['membershipAnswer', 'subscriptionChoice']],
      ['finalizare', 'Finalizare înscriere', ['source', 'sourceOther', 'gdprConsent', 'regulationsConsent']],
    ]);
  });

  it('drops the questions only the old website form had', () => {
    for (const key of ['level', 'howHeard', 'clubInterest', 'privacyConsent', 'regulationsAgreement', 'infoBlock', 'programCard']) {
      expect(q[key]).toBeUndefined();
    }
  });

  it('reads every option list from the constants module', () => {
    expect(q.relationship.q.options).toEqual(pairs(RELATIONSHIP_OPTIONS));
    expect(q.membershipAnswer.q.options).toEqual(pairs(MEMBERSHIP_OPTIONS));
    expect(q.lastSeason.q.options).toEqual(same(LAST_SEASON_OPTIONS));
    expect(q.source.q.options).toEqual(same(SOURCE_OPTIONS));
  });

  it('locks option values so the admin editor cannot add new ones', () => {
    for (const key of ['relationship', 'membershipAnswer', 'lastSeason', 'source']) {
      expect(q[key].q.optionSource).toBe('enum');
    }
  });

  it('takes subscription options from the price lists, never from the registry', () => {
    expect(q.subscriptionChoice.q).toMatchObject({ type: 'select', optionSource: 'none', options: [] });
  });

  it('keeps identity, price-relevant answers and consents required for good', () => {
    for (const key of ['email', 'childName', 'relationship', 'membershipAnswer', 'subscriptionChoice', 'gdprConsent', 'regulationsConsent']) {
      expect(q[key].q.lockedRequired).toBe(true);
    }
  });

  it('asks the follow-up texts only with Alta / Altele (checked at submit)', () => {
    expect(q.relationshipOther.q).toMatchObject({ required: false, canHide: false, defaultLabel: RELATIONSHIP_OTHER_LABEL });
    expect(q.sourceOther.q).toMatchObject({ required: false, canHide: false, defaultLabel: SOURCE_OTHER_LABEL });
  });

  it('asks for confirmation before removing a consent', () => {
    expect(SENSITIVE_BUILTIN_KEYS.has('gdprConsent')).toBe(true);
    expect(SENSITIVE_BUILTIN_KEYS.has('regulationsConsent')).toBe(true);
  });
});
