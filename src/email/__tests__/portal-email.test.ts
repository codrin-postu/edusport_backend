import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { attemptJob } from '../email-jobs';
import { renderPortalMail } from '../portal-direct';
import { inviteLink, isPortalInvitePayload, portalHost, portalInviteJob, renderPortalInvite } from '../portal-email';
import { toJobRow } from '../strapi-email';
import { fakeDeps, LINKS, queuedJob } from './helpers';

const payload = { name: 'Andreea Pascu', link: 'https://antrenor.scoaladepatinaj.com/invitatie/abc', host: 'antrenor.scoaladepatinaj.com' };
const inviteJob = (over = {}) => queuedJob({ kind: 'portal-invite', payload, ...over });

describe('invite mail', () => {
  it('subject and text', () => {
    const r = renderPortalInvite({ payload, links: LINKS });
    expect(r.subject).toBe('Contul tău EduSport de antrenor');
    for (const line of ['Bună ziua, Andreea Pascu,', 'Ai un cont pe antrenor.scoaladepatinaj.com.', 'Linkul este valabil 7 zile.', 'Echipa EduSport', payload.link]) {
      expect(r.text).toContain(line);
    }
    expect(r.html).toContain(`href="${payload.link}"`);
    expect(r.html).toContain('Intră în cont');
  });
  it('payload check refuses a missing link', () => {
    expect(isPortalInvitePayload(payload)).toBe(true);
    expect(isPortalInvitePayload({ name: 'A', host: 'h' })).toBe(false);
    expect(isPortalInvitePayload(null)).toBe(false);
  });
  it('the job is queued at once, address lower case', () => {
    expect(portalInviteJob({ recipient: ' A@B.ro ', accountId: 'a1', payload }, new Date())).toEqual({
      recipient: 'a@b.ro', subject: 'Contul tău EduSport de antrenor', accountId: 'a1', notBefore: null, payload,
    });
  });
  it('the composer picks the invite renderer and the test address gets it outside production', async () => {
    const deps = fakeDeps();
    deps.stored.row = inviteJob();
    expect((await attemptJob(deps, inviteJob())).status).toBe('sent');
    expect(deps.sent).toEqual([{ to: 'test@example.com', subject: 'Contul tău EduSport de antrenor' }]);
  });
  it('a stored job with a broken payload is read as null and fails at once', () => {
    expect(toJobRow({ documentId: 'j', kind: 'portal-invite', payload: { name: 'x' } }).payload).toBeNull();
    expect(toJobRow({ documentId: 'j', kind: 'portal-invite', payload }).kind).toBe('portal-invite');
  });
  it('the email-job schema allows the kind', () => {
    const schema = JSON.parse(readFileSync(join(__dirname, '../../api/email-job/content-types/email-job/schema.json'), 'utf8'));
    expect(schema.attributes.kind.enum).toContain('portal-invite');
  });
});

describe('portalHost and inviteLink', () => {
  it('production', () => {
    expect(portalHost('https://scoaladepatinaj.com')).toEqual({ host: 'antrenor.scoaladepatinaj.com', origin: 'https://antrenor.scoaladepatinaj.com' });
    expect(portalHost('https://www.scoaladepatinaj.com').host).toBe('antrenor.scoaladepatinaj.com');
    expect(inviteLink('antrenor.scoaladepatinaj.com', 's3')).toBe('https://antrenor.scoaladepatinaj.com/invitatie/s3');
  });
  it('local', () => {
    expect(portalHost('http://localhost:3010')).toEqual({ host: 'antrenor.localhost:3010', origin: 'http://antrenor.localhost:3010' });
  });
});

describe('e-mail changed mail', () => {
  it('texts', () => {
    const r = renderPortalMail({ kind: 'email-changed', newEmail: 'nou@example.com' }, LINKS);
    expect(r.subject).toBe('Adresa contului tău de antrenor s-a schimbat');
    expect(r.text).toContain('Adresa contului tău a fost schimbată în nou@example.com.');
    expect(r.text).toContain('Dacă nu ai fost tu, anunță administratorul.');
  });
});
