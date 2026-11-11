import { describe, expect, it } from 'vitest';
import * as copy from '../copy';
import { MAIL_COPY, PORTAL_ACTIONS, portalHistoryText } from '../copy';

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

  it('disable confirmation names the team member, or falls back without a name', () => {
    expect(copy.accountDisableConfirmText('Ana Pop')).toBe('Dezactivezi contul lui Ana Pop? Toate dispozitivele vor fi deconectate.');
    expect(copy.accountDisableConfirmText('')).toBe('Dezactivezi contul? Toate dispozitivele vor fi deconectate.');
    expect(copy.accountDisableConfirmText('   ')).toBe('Dezactivezi contul? Toate dispozitivele vor fi deconectate.');
  });
});
