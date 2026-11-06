import { describe, expect, it } from 'vitest';
import * as copy from '../copy';
import { MAIL_COPY, PORTAL_ACTIONS, portalHistoryText, DEVICE_WORDS } from '../copy';

const collect = (v: unknown): string[] => {
  if (typeof v === 'string') return [v];
  if (typeof v === 'function' || v === null || typeof v !== 'object') return [];
  return Object.values(v).flatMap(collect);
};

const FORBIDDEN = /[–—·]|\p{Extended_Pictographic}/u;

describe('portal copy', () => {
  it('no en dash, em dash, middle dot or emoji in any string', () => {
    const texts = [
      ...collect(copy),
      copy.googleOtherEmail('a@b.ro'),
      MAIL_COPY.reset.code('042517'),
      MAIL_COPY.newDevice.line('Telefon, Chrome', '4 nov 2026', '18:05'),
      ...Object.values(PORTAL_ACTIONS).map((a) => portalHistoryText(a, { email: 'a@b.ro', from: 'a@b.ro', to: 'c@d.ro' }) ?? ''),
    ];
    for (const t of texts) expect(t).not.toMatch(FORBIDDEN);
    expect(texts.length).toBeGreaterThan(40);
  });

  it('device words are the agreed ones', () => {
    expect(DEVICE_WORDS.unknown).toBe('Dispozitiv necunoscut');
    expect(DEVICE_WORDS.tablet).toBe('Tabletă');
  });

  it('history texts', () => {
    expect(portalHistoryText(PORTAL_ACTIONS.inviteSent, { email: 'a@b.ro' })).toBe('Invitație trimisă la a@b.ro.');
    expect(portalHistoryText(PORTAL_ACTIONS.inviteResent, {})).toBe('Invitație retrimisă.');
    expect(portalHistoryText(PORTAL_ACTIONS.activated, {})).toBe('Cont activat.');
    expect(portalHistoryText(PORTAL_ACTIONS.activatedGoogle, {})).toBe('Cont activat cu Google.');
    expect(portalHistoryText(PORTAL_ACTIONS.passwordChanged, {})).toBe('Parolă schimbată.');
    expect(portalHistoryText(PORTAL_ACTIONS.passwordReset, {})).toBe('Parolă resetată.');
    expect(portalHistoryText(PORTAL_ACTIONS.locked, {})).toBe('Cont blocat 15 minute după 5 încercări greșite.');
    expect(portalHistoryText(PORTAL_ACTIONS.disabled, {})).toBe('Cont dezactivat.');
    expect(portalHistoryText(PORTAL_ACTIONS.enabled, {})).toBe('Cont activat de administrator.');
    expect(portalHistoryText(PORTAL_ACTIONS.emailChanged, { from: 'a@b.ro', to: 'c@d.ro' })).toBe('E-mail schimbat din a@b.ro în c@d.ro.');
    expect(portalHistoryText('other', {})).toBeNull();
    expect(portalHistoryText('constructor', {})).toBeNull();
  });

  it('mail copy', () => {
    expect(MAIL_COPY.reset.code('042517')).toBe('Codul tău: 042517');
    expect(MAIL_COPY.newDevice.line('Telefon, Chrome', '4 nov 2026', '18:05')).toBe('Telefon, Chrome, 4 nov 2026 18:05.');
  });
});
