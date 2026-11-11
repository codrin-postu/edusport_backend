import { describe, expect, it } from 'vitest';
import { accountBlockActions } from '../copy-admin';

describe('accountBlockActions', () => {
  it('an active coach account can be disabled', () => {
    expect(accountBlockActions({ state: 'active', hasSportiv: false, coachDisabled: false })).toEqual({ disable: true, enable: false, disableAll: false });
  });
  it('a disabled coach side can be turned back on and not disabled again', () => {
    expect(accountBlockActions({ state: 'active', hasSportiv: true, coachDisabled: true })).toEqual({ disable: false, enable: true, disableAll: true });
  });
  it('a disabled account can be enabled', () => {
    expect(accountBlockActions({ state: 'disabled', hasSportiv: false, coachDisabled: false })).toMatchObject({ disable: false, enable: true });
  });
});
