import { describe, expect, it } from 'vitest';
import { pickSchool } from '../school-choice';

// registrationsOpen is set on purpose: it must not matter yet.
const school = { documentId: 'sec-school', slug: 'afi-cotroceni', kind: 'school', publicPage: true, registrationsOpen: false };
const club = { documentId: 'sec-club', slug: 'club', kind: 'club', publicPage: true, registrationsOpen: true };
const second = { documentId: 'sec-two', slug: 'baneasa', kind: 'school', publicPage: true };
const hidden = { documentId: 'sec-hidden', slug: 'ascunsa', kind: 'school', publicPage: false, registrationsOpen: true };

describe('pickSchool', () => {
  it('uses the single school with a public page when the link has no ?scoala', () => {
    expect(pickSchool([school, club, hidden], null)).toEqual({ ok: true, documentId: 'sec-school', slug: 'afi-cotroceni' });
    expect(pickSchool([school, club], '  ')).toEqual({ ok: true, documentId: 'sec-school', slug: 'afi-cotroceni' });
  });

  it('uses the school named in ?scoala, ignoring case and spaces', () => {
    expect(pickSchool([school, second], ' Baneasa ')).toEqual({ ok: true, documentId: 'sec-two', slug: 'baneasa' });
  });

  it('refuses an unknown slug instead of falling back to another school', () => {
    expect(pickSchool([school, club], 'nu-exista')).toEqual({ ok: false, code: 'unknown-school' });
  });

  it('never takes Club, nor a school without a public page', () => {
    expect(pickSchool([school, club], 'club')).toEqual({ ok: false, code: 'unknown-school' });
    expect(pickSchool([school, hidden], 'ascunsa')).toEqual({ ok: false, code: 'unknown-school' });
  });

  it('asks to choose when 2 or more schools have a public page and none is named', () => {
    expect(pickSchool([school, second], null)).toEqual({ ok: false, code: 'choose-school' });
  });

  it('is closed when no school can take registrations', () => {
    expect(pickSchool([club, hidden], null)).toEqual({ ok: false, code: 'closed' });
    expect(pickSchool([], null)).toEqual({ ok: false, code: 'closed' });
  });
});
