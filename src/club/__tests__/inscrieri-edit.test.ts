import { describe, expect, it } from 'vitest';
import { editFields, editPatch, editToast, initialDraft, storedBirth, visibleFields, type EditDraft } from '../inscrieri-edit';
import { EMPTY_DATE } from '../ui-birth-date';

const script = {
  documentId: 'r1', email: 'parinte@exemplu.ro', parentName: 'Mihaela Dumitrescu', relationship: 'parinte', relationshipOther: null,
  phone: '0722 111 222', childName: 'Maria Dumitrescu', childBirthDate: '14 martie 2016', childHeight: 142, shirtSize: 'S',
  lastSeason: 'Începători', priorExperience: 'Patinaj', expectations: null, membershipAnswer: 'da',
  source: 'Recomandare', sourceOther: null,
};
const legacy = { documentId: 'r7', childName: 'Mihai Pop', childBirthDate: 'ieri', parentName: 'Ion Pop', email: '', phone: '0711', level: 'Incepatori', howHeard: 'Facebook', clubInterest: true };

const draftOf = (row: Record<string, unknown>) => initialDraft(row, editFields(row));
const patchOf = (row: Record<string, unknown>, change: (d: EditDraft) => EditDraft) => editPatch(row, editFields(row), change(draftOf(row)));

describe('"Editează" fields (spec 3.4)', () => {
  it('script form: every answer in form order, the wish and "De unde ați aflat" last under "Abonament", no consents', () => {
    const fields = editFields(script);
    expect(fields.map((f) => [f.key, f.kind, f.section ?? ''])).toEqual([
      ['email', 'text', ''], ['parentName', 'text', ''], ['relationship', 'select', ''], ['relationshipOther', 'text', ''],
      ['phone', 'text', ''], ['childName', 'text', ''], ['childBirthDate', 'birthDate', ''], ['childHeight', 'height', ''],
      ['shirtSize', 'text', ''], ['lastSeason', 'select', ''], ['priorExperience', 'textarea', ''], ['expectations', 'textarea', ''],
      ['membershipAnswer', 'select', 'abonament'], ['source', 'select', 'abonament'], ['sourceOther', 'text', 'abonament'],
    ]);
    expect(fields.find((f) => f.key === 'membershipAnswer')?.options).toEqual([
      { value: 'da', label: 'Da, doresc să devin membru' },
      { value: 'nu', label: 'Nu, optez pentru tarife neafiliați' },
    ]);
    expect(fields.find((f) => f.key === 'relationshipOther')?.label).toBe('Specificați calitatea (ex: Bunic, Frate):');
    expect(fields.find((f) => f.key === 'source')?.label).toBe('De unde ați aflat');
    expect(fields.find((f) => f.key === 'source')?.options).toEqual([
      { value: 'Facebook', label: 'Facebook' }, { value: 'Instagram', label: 'Instagram' }, { value: 'Recomandare', label: 'Recomandare' },
      { value: 'Căutare Google', label: 'Căutare Google' }, { value: 'Altele', label: 'Altele' },
    ]);
    expect(fields.find((f) => f.key === 'sourceOther')?.label).toBe('Vă rugăm să specificați de unde ați aflat de noi:');
  });

  it('the "Alta" text shows only for Alta', () => {
    const fields = editFields(script);
    const draft = draftOf(script);
    expect(visibleFields(fields, draft).some((f) => f.key === 'relationshipOther')).toBe(false);
    const alta = { ...draft, text: { ...draft.text, relationship: 'alta' } };
    expect(visibleFields(fields, alta).some((f) => f.key === 'relationshipOther')).toBe(true);
  });

  it('the "Altele" text shows only while the source is Altele', () => {
    const fields = editFields(script);
    const draft = draftOf(script);
    expect(visibleFields(fields, draft).some((f) => f.key === 'sourceOther')).toBe(false);
    const altele = { ...draft, text: { ...draft.text, source: 'Altele' } };
    expect(visibleFields(fields, altele).some((f) => f.key === 'sourceOther')).toBe(true);
  });

  it('old registrations: their own answers (Needs decision 3, A)', () => {
    expect(editFields(legacy).map((f) => [f.label, f.kind, f.section ?? ''])).toEqual([
      ['Email', 'text', ''], ['Nume părinte', 'text', ''], ['Telefon', 'text', ''], ['Nume sportiv', 'text', ''],
      ['Data nașterii', 'birthDate', ''], ['Mărime tricou', 'text', ''], ['Nivel', 'text', ''],
      ['Experiență anterioară', 'textarea', ''], ['Așteptări', 'textarea', ''],
      ['Cum a aflat', 'text', 'abonament'], ['Interes club', 'bool', 'abonament'],
    ]);
  });
});

describe('draft and patch', () => {
  it('a readable stored date fills the picker; an unreadable one leaves it empty', () => {
    expect(storedBirth('14 martie 2016')).toEqual({ day: 14, month: 3, year: 2016 });
    expect(storedBirth('ieri')).toEqual(EMPTY_DATE);
    expect(storedBirth(null)).toEqual(EMPTY_DATE);
    expect(draftOf(script).text.childHeight).toBe('142');
  });

  it('nothing changed: an empty patch', () => {
    expect(editPatch(script, editFields(script), draftOf(script))).toEqual({ patch: {}, error: null });
  });

  it('sends only the changed answers, trimmed', () => {
    const result = patchOf(script, (d) => ({ ...d, text: { ...d.text, phone: ' 0722 111 223 ', childHeight: '' } }));
    expect(result).toEqual({ patch: { phone: '0722 111 223', childHeight: '' }, error: null });
  });

  it('an untouched unreadable birth date stays as it is while other answers save', () => {
    const result = patchOf(legacy, (d) => ({ ...d, text: { ...d.text, phone: '0712' } }));
    expect(result).toEqual({ patch: { phone: '0712' }, error: null });
  });

  it('a touched, incomplete date is refused with the picker error', () => {
    const result = patchOf(legacy, (d) => ({ ...d, birth: { day: 2, month: 9, year: null }, birthTouched: true }));
    expect(result).toEqual({ patch: {}, error: 'Alegeți data nașterii.' });
  });

  it('a picked date is saved as ZZ.LL.AAAA; the same date in an old form is rewritten', () => {
    expect(patchOf(legacy, (d) => ({ ...d, birth: { day: 2, month: 9, year: 2016 }, birthTouched: true })).patch).toEqual({ childBirthDate: '02.09.2016' });
    expect(patchOf(script, (d) => ({ ...d, birthTouched: true })).patch).toEqual({ childBirthDate: '14.03.2016' });
    const same = { ...script, childBirthDate: '14.03.2016' };
    expect(patchOf(same, (d) => ({ ...d, birthTouched: true })).patch).toEqual({});
  });

  it('a hidden "Alta" text is not sent; booleans are', () => {
    expect(patchOf(script, (d) => ({ ...d, text: { ...d.text, relationshipOther: 'Bunic' } })).patch).toEqual({});
    expect(patchOf(legacy, (d) => ({ ...d, bools: { ...d.bools, clubInterest: false } })).patch).toEqual({ clubInterest: false });
  });

  it('a hidden "Altele" text is not sent; a chosen source is', () => {
    expect(patchOf(script, (d) => ({ ...d, text: { ...d.text, sourceOther: 'Un prieten' } })).patch).toEqual({});
    expect(patchOf(script, (d) => ({ ...d, text: { ...d.text, source: 'Facebook' } })).patch).toEqual({ source: 'Facebook' });
    expect(
      patchOf(script, (d) => ({ ...d, text: { ...d.text, source: 'Altele', sourceOther: 'Un prieten' } })).patch,
    ).toEqual({ source: 'Altele', sourceOther: 'Un prieten' });
  });
});

describe('save toast (spec 3.4)', () => {
  it('follows the PUT answer', () => {
    expect(editToast({ changed: [] })).toEqual({ tone: 'info', text: 'Nicio modificare.' });
    expect(editToast({ changed: ['phone'], rebuild: { ok: true, documents: ['acord'] } })).toEqual({ tone: 'success', text: 'Salvat. Documentul a fost refăcut.' });
    expect(editToast({ changed: ['phone'], rebuild: { ok: false, documents: [] } })).toEqual({ tone: 'warning', text: 'Salvat. Documentul PDF nu a putut fi refăcut.' });
    expect(editToast({ changed: ['expectations'], rebuild: null })).toEqual({ tone: 'success', text: 'Salvat' });
    expect(editToast(null)).toEqual({ tone: 'success', text: 'Salvat' });
  });
});
