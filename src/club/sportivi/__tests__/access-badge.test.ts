import { describe, expect, it } from 'vitest';
import { accessBadge, accessBadgeState } from '../access-badge';

describe('accessBadge', () => {
  it('maps the three states to the three words and tones', () => {
    expect(accessBadge('none')).toEqual({ text: 'FĂRĂ ACCES', tone: 'neutral' });
    expect(accessBadge('invited')).toEqual({ text: 'INVITAT', tone: 'warning' });
    expect(accessBadge('active')).toEqual({ text: 'ACTIV', tone: 'success' });
  });
  it('reads a disabled account as no access', () => {
    expect(accessBadgeState('disabled')).toBe('none');
    expect(accessBadgeState('invited')).toBe('invited');
    expect(accessBadgeState('active')).toBe('active');
    expect(accessBadgeState('none')).toBe('none');
  });
});
