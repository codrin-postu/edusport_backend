import { describe, expect, it } from 'vitest';
import type { AccountRow, UserAuth } from '../../types';
import { accessState, canEnterHost, holderName, inviteRefusal, isAdult, planInvite } from '../rules';
import type { AccessRow } from '../types';

const account = (over: Partial<AccountRow> = {}): AccountRow => ({
  id: 'a1', userId: 1, email: 'x@example.invalid', status: 'active', teamMemberId: 'tm1', phone: null, googleSub: null, googleUnlinkedAt: null, invitedAt: null, invitedBy: null,
  activatedAt: null, disabledAt: null, disabledBy: null, lastLoginAt: null, name: null, coachDisabledAt: null, passwordChangedAt: null, notifySchedule: true, ...over,
});
const user = (over: Partial<UserAuth> = {}): UserAuth => ({ id: 1, email: 'x@example.invalid', passwordHash: 'h', blocked: false, confirmed: true, ...over });
const live = (): AccessRow => ({
  id: 'x', athleteId: 'at', accountId: 'a1', email: 'x@example.invalid', invitedAt: '', invitedBy: '', revokedAt: null, revokedBy: null, revokeReason: null, levelSeenGroup: null, levelSeenAt: null,
});

describe('canEnterHost', () => {
  it('an active coach enters antrenor without any access, and sportiv only with a live one', () => {
    expect(canEnterHost(account(), user(), 'antrenor', 0)).toBe(true);
    expect(canEnterHost(account(), user(), 'sportiv', 0)).toBe(false);
    expect(canEnterHost(account(), user(), 'sportiv', 1)).toBe(true);
  });

  it('a holder without a team member enters sportiv only', () => {
    const holder = account({ teamMemberId: null });
    expect(canEnterHost(holder, user(), 'antrenor', 2)).toBe(false);
    expect(canEnterHost(holder, user(), 'sportiv', 2)).toBe(true);
  });

  it('a disabled coach side closes antrenor but keeps sportiv', () => {
    const half = account({ coachDisabledAt: '2026-11-11T10:00:00.000Z' });
    expect(canEnterHost(half, user(), 'antrenor', 1)).toBe(false);
    expect(canEnterHost(half, user(), 'sportiv', 1)).toBe(true);
  });

  it('an invited, disabled or blocked account, a missing row and another host are refused', () => {
    for (const host of ['antrenor', 'sportiv']) {
      expect(canEnterHost(account({ status: 'invited' }), user(), host, 1)).toBe(false);
      expect(canEnterHost(account({ status: 'disabled' }), user(), host, 1)).toBe(false);
      expect(canEnterHost(account(), user({ blocked: true }), host, 1)).toBe(false);
      expect(canEnterHost(null, user(), host, 1)).toBe(false);
      expect(canEnterHost(account(), null, host, 1)).toBe(false);
    }
    expect(canEnterHost(account(), user(), 'admin', 1)).toBe(false);
  });
});

describe('planInvite', () => {
  it('follows the four outcomes', () => {
    expect(planInvite(null, null)).toEqual({ kind: 'create' });
    expect(planInvite(account(), null)).toEqual({ kind: 'add' });
    expect(planInvite(account({ status: 'invited' }), 'antrenor')).toEqual({ kind: 'reinvite', host: 'antrenor' });
    expect(planInvite(account({ status: 'invited' }), null)).toEqual({ kind: 'reinvite', host: 'sportiv' });
    expect(planInvite(account({ status: 'disabled' }), null)).toEqual({ kind: 'refuse', message: 'Contul acestei adrese este dezactivat.' });
  });
});

describe('inviteRefusal', () => {
  it('names the reason an athlete cannot be invited', () => {
    expect(inviteRefusal({ status: 'nou', email: 'a@example.invalid' })).toBe('Confirmă sportivul întâi.');
    expect(inviteRefusal({ status: 'activ', email: null })).toBe('Adaugă un e-mail în Date.');
    expect(inviteRefusal({ status: 'anonimizat', email: null })).toBe('Sportivul este anonimizat.');
    expect(inviteRefusal({ status: 'activ', email: 'a@example.invalid' })).toBeNull();
  });
});

describe('accessState, isAdult, holderName', () => {
  it('derives the state from the account, none without a live access', () => {
    expect(accessState(account(), null)).toBe('none');
    expect(accessState(account({ status: 'invited' }), live())).toBe('invited');
    expect(accessState(account(), live())).toBe('active');
    expect(accessState(account({ status: 'disabled' }), live())).toBe('disabled');
  });

  it('an athlete is an adult on the 18th birthday, not the day before', () => {
    expect(isAdult('2008-11-07', '2026-11-07')).toBe(true);
    expect(isAdult('2008-11-08', '2026-11-07')).toBe(false);
    expect(isAdult(null, '2026-11-07')).toBe(false);
  });

  it('the holder name prefers a non-empty contact name', () => {
    expect(holderName({ contactName: '  Maria Ionescu ', name: 'Ana Ionescu' })).toBe('Maria Ionescu');
    expect(holderName({ contactName: '   ', name: 'Ana Ionescu' })).toBe('Ana Ionescu');
    expect(holderName({ contactName: null, name: 'Ana Ionescu' })).toBe('Ana Ionescu');
  });
});
