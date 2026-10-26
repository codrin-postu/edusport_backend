import { describe, expect, it } from 'vitest';
import { firstRowOf } from '../client';
import { LINK_TEXT, linkRequests, toCells, toDisplay } from '../format';

const URL = 'https://cms.example.ro/admin/plugins/edusport-inscrieri?q=2026-0142&season=all';

describe('link cells', () => {
  it('write the text and keep the address for the link', () => {
    expect(LINK_TEXT).toBe('Deschide documentul');
    expect(toCells(['text', 'link'], ['a', URL])).toEqual(['a', { kind: 'link', text: 'Deschide documentul', url: URL }]);
    expect(toDisplay(['text', 'link'], ['a', URL])).toEqual(['a', 'Deschide documentul']);
  });

  it('stay empty without an address', () => {
    expect(toCells(['link'], [''])).toEqual(['']);
    expect(toDisplay(['link'], [''])).toEqual(['']);
  });

  it('become one rich-text link request per link cell, at its sheet position', () => {
    const rows = toCells(['text', 'link'], ['a', URL]);
    expect(linkRequests(7, 4, [rows, ['b', '']])).toEqual([
      {
        updateCells: {
          range: { sheetId: 7, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 1, endColumnIndex: 2 },
          rows: [
            {
              values: [
                {
                  userEnteredValue: { stringValue: 'Deschide documentul' },
                  textFormatRuns: [{ startIndex: 0, format: { link: { uri: URL } } }],
                },
              ],
            },
          ],
          fields: 'userEnteredValue,textFormatRuns',
        },
      },
    ]);
  });

  it('find where appended rows landed from the API range', () => {
    expect(firstRowOf("'2026-2027'!A5:Y6")).toBe(5);
    expect(firstRowOf('Date!$A$12:$C$12')).toBe(12);
    expect(firstRowOf(undefined)).toBeNull();
  });
});
