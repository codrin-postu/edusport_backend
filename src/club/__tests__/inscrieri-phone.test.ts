import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { PHONE_COPY, WHATSAPP_MESSAGE, fillMessage, smsUrl, whatsappMessage, whatsappUrl } from '../inscrieri-phone';

const names = { parinte: 'Ana', copil: 'Mihai' };
const admin = (...p: string[]) => readFileSync(join(__dirname, '..', '..', 'admin', 'dashboard', ...p), 'utf8');

it('builds the wa.me link from the E.164 digits and the edited message', () => {
  expect(whatsappUrl('0722123456', 'Bună ziua & mulțumim')).toBe('https://wa.me/40722123456?text=' + encodeURIComponent('Bună ziua & mulțumim'));
  expect(whatsappUrl('+40 722 123 456', 'x')).toContain('https://wa.me/40722123456?');
});

it('prefills the dialog with the template and the names', () => {
  expect(whatsappMessage(names)).toBe(fillMessage(WHATSAPP_MESSAGE, names));
});

it('has no link for a phone that does not parse', () => {
  expect(whatsappUrl('0722 12', 'x')).toBeNull();
  expect(whatsappUrl('', 'x')).toBeNull();
});

it('fills the placeholders of a template', () => {
  expect(fillMessage('Buna {parinte}, {copil}', names)).toBe('Buna Ana, Mihai');
});

it('uses the user\'s message text', () => {
  expect(WHATSAPP_MESSAGE).toBe('Bună ziua! Confirmăm înscrierea la cursurile de patinaj. În următoarele zile veți primi un SMS cu ora/grupa. O zi frumoasă!\n\nȘcoala de Patinaj EduSport');
});

it('builds the sms link with the E.164 number and the edited message', () => {
  expect(smsUrl('0722123456', 'Bună & ziua')).toBe('sms:+40722123456?body=' + encodeURIComponent('Bună & ziua'));
  expect(smsUrl('0722 12', 'x')).toBeNull();
});

it('the WhatsApp dialog edits the message, opens WhatsApp itself and changes the status only through the saved status box', () => {
  const src = admin('inscrieri', 'PhoneActions.tsx');
  expect(src).toContain('<Textarea');
  expect(src).toContain('whatsappUrl(raw, text)');
  expect(src).toContain('smsUrl(raw, text)');
  expect(src).toContain('api.statusBox(row)');
  expect(src).not.toMatch(/saveField\(/);
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
