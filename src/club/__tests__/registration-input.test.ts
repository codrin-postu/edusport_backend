import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { questionMap } from '../../api/form-config/registry';
import { MEMBERSHIP_OPTIONS, RELATIONSHIP_OPTIONS, SOURCE_OPTIONS, SOURCE_OTHER, LAST_SEASON_OPTIONS } from '../registration-form-options';
import {
  MAX_TEXT,
  RULE_ERRORS,
  checkRegistrationRules,
  parseChildHeight,
  presenceValues,
  readRegistrationInput,
  selectValues,
} from '../registration-input';

const BODY = {
  email: ' ana.pop@example.com ',
  parentName: 'Ana Pop',
  relationship: 'parinte',
  phone: '0712345678',
  childName: 'Maria Pop',
  childBirthDate: '14.03.2016',
  childHeight: 132,
  shirtSize: 'S',
  lastSeason: LAST_SEASON_OPTIONS[0],
  priorExperience: 'Nu este cazul',
  expectations: 'Să învețe să patineze',
  membershipAnswer: 'da',
  subscriptionChoice: { priceItemName: ' Abonament 8 ședințe grup ', price: 1, member: false },
  source: SOURCE_OPTIONS[0],
  gdprConsent: true,
  regulationsConsent: 'true',
  website: '',
};
const always = () => true;

describe('readRegistrationInput', () => {
  it('reads and trims the answers; takes only the item name from the choice', () => {
    const input = readRegistrationInput(BODY);
    expect(input).toMatchObject({ email: 'ana.pop@example.com', childHeight: '132', priceItemName: 'Abonament 8 ședințe grup', gdprConsent: true, regulationsConsent: true });
    expect(JSON.stringify(input)).not.toContain('"price"');
  });

  it('treats non-strings as empty and cuts long text', () => {
    const input = readRegistrationInput({ email: 7, expectations: 'x'.repeat(MAX_TEXT + 10), subscriptionChoice: 'Abonament' });
    expect(input.email).toBe('');
    expect(input.expectations).toHaveLength(MAX_TEXT);
    expect(input.priceItemName).toBe('');
    expect(input.gdprConsent).toBe(false);
  });
});

describe('registry alignment', () => {
  const registry = questionMap('inscriere');

  it('every presence key is a registry question', () => {
    for (const key of Object.keys(presenceValues(readRegistrationInput(BODY)))) expect(registry[key]).toBeDefined();
  });

  it('select values are exactly the registry selects with fixed options', () => {
    expect(Object.keys(selectValues(readRegistrationInput(BODY))).sort()).toEqual(['lastSeason', 'membershipAnswer', 'relationship', 'source']);
  });

  it('stored enum values match the schema', () => {
    const schema = JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'api', 'registration-submission', 'content-types', 'registration-submission', 'schema.json'), 'utf8'),
    );
    expect(schema.attributes.relationship.enum).toEqual(RELATIONSHIP_OPTIONS.map((o) => o.value));
    expect(schema.attributes.membershipAnswer.enum).toEqual(MEMBERSHIP_OPTIONS.map((o) => o.value));
  });
});

describe('parseChildHeight', () => {
  it('accepts whole centimetres in range', () => {
    expect(parseChildHeight('132')).toBe(132);
    expect(parseChildHeight('50')).toBe(50);
    expect(parseChildHeight('230')).toBe(230);
  });
  it('rejects anything else', () => {
    for (const raw of ['49', '231', '13a', '1.32', '', '1320']) expect(parseChildHeight(raw)).toBeNull();
  });
});

describe('checkRegistrationRules', () => {
  const input = (over: Record<string, unknown>) => readRegistrationInput({ ...BODY, ...over });

  it('passes a complete answer set', () => expect(checkRegistrationRules(input({}), always)).toBeNull());

  it('asks for the relationship text with Alta', () => {
    expect(checkRegistrationRules(input({ relationship: 'alta' }), always)).toBe(RULE_ERRORS.relationshipOther);
    expect(checkRegistrationRules(input({ relationship: 'alta', relationshipOther: 'Bunic' }), always)).toBeNull();
  });

  it('asks for the source text with Altele', () => {
    expect(checkRegistrationRules(input({ source: SOURCE_OTHER }), always)).toBe(RULE_ERRORS.sourceOther);
    expect(checkRegistrationRules(input({ source: SOURCE_OTHER, sourceOther: 'Ziar' }), always)).toBeNull();
  });

  it('rejects an impossible height', () => expect(checkRegistrationRules(input({ childHeight: '13' }), always)).toBe(RULE_ERRORS.childHeight));

  it('rejects values outside the stored enums', () => {
    expect(checkRegistrationRules(input({ relationship: 'Părinte' }), always)).toBe(RULE_ERRORS.choice);
    expect(checkRegistrationRules(input({ membershipAnswer: 'Da' }), always)).toBe(RULE_ERRORS.choice);
  });

  it('requires both consents while they are required', () => {
    expect(checkRegistrationRules(input({ gdprConsent: false }), always)).toBe(RULE_ERRORS.gdprConsent);
    expect(checkRegistrationRules(input({ regulationsConsent: false }), always)).toBe(RULE_ERRORS.regulationsConsent);
    expect(checkRegistrationRules(input({ gdprConsent: false }), (key) => key !== 'gdprConsent')).toBeNull();
  });
});
