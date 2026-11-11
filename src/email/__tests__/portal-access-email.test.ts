import { describe, expect, it } from 'vitest';
import { attemptJob } from '../email-jobs';
import { isPortalAccessPayload, portalAccessJob, renderPortalAccess, type PortalAccessPayload } from '../portal-access-email';
import { isPortalInvitePayload, portalInviteJob, renderPortalInvite } from '../portal-email';
import { toJobRow } from '../strapi-email';
import { fakeDeps, LINKS, queuedJob } from './helpers';

const child: PortalAccessPayload = { name: 'Ioana Ionescu', variant: 'child', childName: 'Ana Ionescu', link: 'https://sportiv.scoaladepatinaj.com/', host: 'sportiv.scoaladepatinaj.com' };
const coach: PortalAccessPayload = { name: 'Ioana Ionescu', variant: 'coach', childName: null, link: 'https://antrenor.scoaladepatinaj.com/', host: 'antrenor.scoaladepatinaj.com' };

describe('access mail', () => {
  it('child variant: subject, line, button link', () => {
    const r = renderPortalAccess({ payload: child, links: LINKS });
    expect(r.subject).toBe('Acces nou în portalul EduSport');
    expect(r.text).toContain('Ai acces și la Ana Ionescu în portalul EduSport.');
    expect(r.html).toContain(`href="${child.link}"`);
    expect(r.html).toContain('Intră în portal');
  });
  it('coach variant names the antrenor host', () => {
    expect(renderPortalAccess({ payload: coach, links: LINKS }).text).toContain('Poți intra și pe antrenor.scoaladepatinaj.com cu același cont.');
  });
  it('payload check refuses a child mail without a child name and a bad variant', () => {
    expect(isPortalAccessPayload(child)).toBe(true);
    expect(isPortalAccessPayload(coach)).toBe(true);
    expect(isPortalAccessPayload({ ...child, childName: null })).toBe(false);
    expect(isPortalAccessPayload({ ...child, variant: 'x' })).toBe(false);
    expect(isPortalAccessPayload(null)).toBe(false);
  });
  it('the job is queued at once, address lower case', () => {
    expect(portalAccessJob({ recipient: ' A@B.ro ', accountId: 'a1', payload: child })).toEqual({
      recipient: 'a@b.ro', subject: 'Acces nou în portalul EduSport', accountId: 'a1', notBefore: null, payload: child,
    });
  });
  it('a stored job of the kind is sent through the access renderer; a broken payload fails at once', async () => {
    const deps = fakeDeps();
    const job = queuedJob({ kind: 'portal-access', payload: child });
    deps.stored.row = job;
    expect((await attemptJob(deps, job)).status).toBe('sent');
    expect(deps.sent).toEqual([{ to: 'test@example.com', subject: 'Acces nou în portalul EduSport' }]);
    expect(toJobRow({ documentId: 'j', kind: 'portal-access', payload: { name: 'x' } }).payload).toBeNull();
    expect(toJobRow({ documentId: 'j', kind: 'portal-access', payload: child }).kind).toBe('portal-access');
  });
});

describe('parent invite mail', () => {
  const parent = { name: 'Ioana Ionescu', link: 'https://sportiv.scoaladepatinaj.com/invite/abc', host: 'sportiv.scoaladepatinaj.com', children: ['Ana Ionescu', 'Matei Ionescu'] };
  it('a sportiv host gets the parent copy and several children are joined', () => {
    const r = renderPortalInvite({ payload: parent, links: LINKS });
    expect(r.subject).toBe('Acces la portalul EduSport');
    expect(r.text).toContain('Ai primit acces la portalul EduSport pentru Ana Ionescu și Matei Ionescu.');
    expect(r.html).toContain('Intră în portal');
    expect(portalInviteJob({ recipient: 'a@b.ro', accountId: 'a', payload: parent }, new Date()).subject).toBe('Acces la portalul EduSport');
  });
  it('an antrenor host keeps the coach copy, and a payload without children stays valid', () => {
    const coachInvite = { name: 'Andreea Pascu', link: 'https://antrenor.scoaladepatinaj.com/invite/abc', host: 'antrenor.scoaladepatinaj.com' };
    expect(isPortalInvitePayload(coachInvite)).toBe(true);
    expect(isPortalInvitePayload({ ...parent, children: [1] })).toBe(false);
    expect(renderPortalInvite({ payload: coachInvite, links: LINKS }).subject).toBe('Contul tău EduSport de antrenor');
  });
});
