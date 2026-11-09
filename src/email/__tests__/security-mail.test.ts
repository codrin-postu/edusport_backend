import { describe, expect, it } from 'vitest';
import { renderSecurityMail } from '../security-mail';

const links = {
  site: 'https://scoaladepatinaj.com',
  program: 'https://scoaladepatinaj.com/cursuri/program',
  privacy: 'https://scoaladepatinaj.com/protectia-datelor',
  headerImage: null,
  whatsapp: null,
  phone: '0255 000 000',
  email: 'inscrieri@scoaladepatinaj.com',
  facebook: null,
};

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

describe('renderSecurityMail', () => {
  it('code: subject, the three lines, signature, the code once in html and text and not in the subject', () => {
    const r = renderSecurityMail('code', { code: '123456' }, links);
    expect(r.subject).toBe('Codul tău pentru 2FA');
    for (const line of ['Codul tău: 123456', 'Este valabil 10 minute.', 'Dacă nu ai încercat tu să intri, schimbă parola.', 'Echipa EduSport']) {
      expect(r.html).toContain(line);
      expect(r.text).toContain(line);
    }
    expect(count(r.html, '123456')).toBe(1);
    expect(count(r.text, '123456')).toBe(1);
    expect(r.subject).not.toContain('123456');
  });

  it('lockout2fa: the 2FA line in the lockout letter', () => {
    const r = renderSecurityMail('lockout2fa', {}, links);
    expect(r.subject).toBe('Încercări de intrare în cont');
    expect(r.text).toContain('Am oprit intrarea în contul tău pentru 15 minute după 5 coduri greșite.');
    expect(r.html).toContain('Echipa EduSport');
  });

  it('reset2fa', () => {
    const r = renderSecurityMail('reset2fa', {}, links);
    expect(r.subject).toBe('2FA a fost resetat');
    expect(r.text).toContain('Administratorul a resetat 2FA pentru contul tău.');
    expect(r.text).toContain('Dacă nu ai cerut tu, anunță administratorul.');
  });

  it('changed: passkey and 2FA off', () => {
    const passkey = renderSecurityMail('changed', { passkey: 'Telefon' }, links);
    expect(passkey.subject).toBe('Setările contului tău s-au schimbat');
    expect(passkey.text).toContain('A fost creată o cheie de acces: Telefon.');
    expect(passkey.html).toContain('A fost creată o cheie de acces: Telefon.');
    expect(passkey.text).toContain('Dacă nu ai fost tu, schimbă parola.');
    const off = renderSecurityMail('changed', { twoFactorOff: true }, links);
    expect(off.text).toContain('2FA a fost oprit.');
  });

  it('escapes a passkey name in the html', () => {
    expect(renderSecurityMail('changed', { passkey: '<b>x</b>' }, links).html).not.toContain('<b>x</b>');
  });
});
