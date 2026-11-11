import { describe, expect, it } from 'vitest';
import type { AccessBlock } from '../../portal/access/api-types';
import { accessActions } from '../access-view';

const block = (state: AccessBlock['state'], canInvite: boolean): AccessBlock => ({
  athleteId: 'a1', state, email: null, since: null, adult: false, canInvite, hint: null,
});

describe('accessActions', () => {
  it('offers the invite when there is no access and it can be sent', () => {
    expect(accessActions(block('none', true))).toEqual(['invite']);
  });
  it('offers resend and remove while invited', () => {
    expect(accessActions(block('invited', false))).toEqual(['resend', 'remove']);
  });
  it('offers remove on an active access', () => {
    expect(accessActions(block('active', false))).toEqual(['remove']);
  });
  it('offers nothing when the invite is refused', () => {
    expect(accessActions(block('none', false))).toEqual([]);
  });
});
