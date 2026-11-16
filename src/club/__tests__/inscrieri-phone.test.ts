import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { PHONE_COPY, WHATSAPP_MESSAGE, fillMessage, statusAfterWhatsapp, whatsappUrl } from '../inscrieri-phone';

const names = { parinte: 'Ana', copil: 'Mihai' };
const admin = (...p: string[]) => readFileSync(join(__dirname, '..', '..', 'admin', 'dashboard', ...p), 'utf8');

it('builds the wa.me link from the E.164 digits and the message', () => {
  expect(whatsappUrl('0722123456', names)).toBe('https://wa.me/40722123456?text=' + encodeURIComponent(WHATSAPP_MESSAGE));
  expect(whatsappUrl('+40 722 123 456', names)).toContain('https://wa.me/40722123456?');
});

it('has no link for a phone that does not parse', () => {
  expect(whatsappUrl('0722 12', names)).toBeNull();
  expect(whatsappUrl('', names)).toBeNull();
});

it('fills the placeholders of a template', () => {
  expect(fillMessage('Buna {parinte}, {copil}', names)).toBe('Buna Ana, Mihai');
});

it('the message stays a marked gap until the user writes it', () => {
  expect(WHATSAPP_MESSAGE).toContain('COPY NEEDED');
});

it('WhatsApp moves only a "Nou" registration to "Contactat"', () => {
  expect(statusAfterWhatsapp('Nou')).toBe('Contactat');
  for (const s of ['Contactat', 'Confirmat', 'Respins']) expect(statusAfterWhatsapp(s)).toBeNull();
});

it('uses the copied text', () => {
  expect(PHONE_COPY.copied).toBe('Copiat.');
});

it('the panel row and the list column use PhoneActions, which imports only ui and club modules', () => {
  expect(admin('inscrieri', 'DateTab.tsx')).toContain('PhoneActions');
  expect(admin('InscrieriPage.tsx')).toContain('PhoneActions');
  const imports = [...admin('inscrieri', 'PhoneActions.tsx').matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  for (const from of imports) expect(from).toMatch(/^(react|\.\.\/\.\.\/ui(\/icons)?|\.\.\/SubmissionTable|\.\.\/\.\.\/\.\.\/club\/.+)$/);
});
