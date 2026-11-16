import { BP } from '../../ui-breakpoints';
import { describe, expect, it } from 'vitest';
import { EXPORT_FORMATS, RAIL_KEY, pageTitle, railInitial, railStored } from '../shell-state';

describe('rail state', () => {
  it('the remembered choice wins at any width', () => {
    expect(railInitial('0', 1440)).toBe(false);
    expect(railInitial('1', 600)).toBe(true);
  });
  it('with nothing remembered the rail is closed up to the tablet width and open above', () => {
    expect(railInitial(null, BP.tablet)).toBe(false);
    expect(railInitial(null, BP.tablet + 1)).toBe(true);
  });
  it('an unknown stored value counts as nothing remembered', () => {
    expect(railInitial('zzz', 1440)).toBe(true);
    expect(railInitial('zzz', 500)).toBe(false);
  });
  it('stores and reads back', () => {
    expect(railStored(true)).toBe('1');
    expect(railStored(false)).toBe('0');
    for (const open of [true, false]) expect(railInitial(railStored(open), open ? 500 : 1440)).toBe(open);
    expect(RAIL_KEY).toBe('tabele-rail');
  });
});

describe('page title', () => {
  it('is the view name, else the type label', () => {
    expect(pageTitle({ name: 'Restanțe' }, 'Abonamente')).toBe('Restanțe');
    expect(pageTitle(null, 'Abonamente')).toBe('Abonamente');
  });
});

describe('export formats', () => {
  it('Excel first (the primary click), then CSV', () => {
    expect(EXPORT_FORMATS).toEqual([{ format: 'xlsx', label: 'Excel' }, { format: 'csv', label: 'CSV' }]);
  });
});
