import { describe, expect, it } from 'vitest';
import { keepsAltArrows } from '../ui-reorder';

const target = (tagName: string, extra: { isContentEditable?: boolean; insideCombobox?: boolean } = {}) => ({
  tagName,
  isContentEditable: extra.isContentEditable ?? false,
  insideCombobox: extra.insideCombobox ?? false,
});

describe('keepsAltArrows', () => {
  it('text fields and native selects keep Alt+arrows', () => {
    expect(keepsAltArrows(target('INPUT'))).toBe(true);
    expect(keepsAltArrows(target('TEXTAREA'))).toBe(true);
    expect(keepsAltArrows(target('SELECT'))).toBe(true);
    expect(keepsAltArrows(target('DIV', { isContentEditable: true }))).toBe(true);
  });

  it('the custom Select (a button with role combobox) keeps Alt+arrows, so the row does not move', () => {
    expect(keepsAltArrows(target('BUTTON', { insideCombobox: true }))).toBe(true);
    expect(keepsAltArrows(target('SPAN', { insideCombobox: true }))).toBe(true);
  });

  it('anything else on the row lets Alt+arrows reorder', () => {
    expect(keepsAltArrows(target('BUTTON'))).toBe(false);
    expect(keepsAltArrows(target('LI'))).toBe(false);
  });
});
