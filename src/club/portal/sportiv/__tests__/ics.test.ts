import { describe, expect, it } from 'vitest';
import type { CalendarItem } from '../api-types';
import { toIcs } from '../ics';

const item = (over: Partial<CalendarItem> = {}): CalendarItem => ({
  date: '2026-11-21', startTime: '11:00', endTime: '11:50', kind: 'grupa', title: 'Intermediari Bronze', location: 'AFI Cotroceni', coaches: ['Virgil Pascu'], cancelled: false, note: null, ...over,
});
const NOW = new Date('2026-11-20T10:00:00.000Z');
const unfolded = (ics: string): string => ics.replace(/\r\n /g, '');

describe('toIcs', () => {
  it('is a calendar with the zone and one event per item with its times, summary and location', () => {
    const ics = toIcs([item()], NOW, 'Ana');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('TZID=Europe/Bucharest');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain('DTSTART;TZID=Europe/Bucharest:20261121T110000');
    expect(ics).toContain('DTEND;TZID=Europe/Bucharest:20261121T115000');
    expect(ics).toContain('SUMMARY:Intermediari Bronze');
    expect(ics).toContain('LOCATION:AFI Cotroceni');
    expect(ics).toMatch(/UID:grupa-[^\r\n]*2026-11-21@edusport\r\n/);
  });

  it('every line ends CRLF, none alone', () => {
    const ics = toIcs([item()], NOW, 'Ana');
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('leaves out cancelled items and days before today, keeps today', () => {
    const ics = toIcs([item({ date: '2026-11-19' }), item({ date: '2026-11-20', title: 'Azi' }), item({ date: '2026-11-22', cancelled: true, note: 'x' }), item({ date: '2026-11-23', title: 'Luni' })], NOW, 'Ana');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('SUMMARY:Azi');
    expect(ics).toContain('SUMMARY:Luni');
    expect(ics).not.toContain('2026-11-22');
  });

  it('takes the day in Bucharest: just after midnight there is already the next day', () => {
    const ics = toIcs([item({ date: '2026-11-20' }), item({ date: '2026-11-21' })], new Date('2026-11-20T22:30:00.000Z'), 'Ana');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it('writes at most 300 events', () => {
    const many = Array.from({ length: 350 }, (_, n) => item({ date: '2026-12-01', startTime: `${String(8 + (n % 12)).padStart(2, '0')}:00`, title: `Ora ${n}` }));
    expect(toIcs(many, NOW, 'Ana').match(/BEGIN:VEVENT/g)).toHaveLength(300);
  });

  it('gives each item its own stable UID', () => {
    const items = [item(), item({ startTime: '17:00', endTime: '18:30', title: 'Club Performanță' }), item({ kind: 'individual', title: 'lecție individuală', startTime: '17:00' })];
    const uids = toIcs(items, NOW, 'Ana').match(/UID:[^\r\n]+/g) ?? [];
    expect(new Set(uids).size).toBe(3);
    expect(toIcs(items, new Date('2026-11-20T11:00:00.000Z'), 'Ana').match(/UID:[^\r\n]+/g)).toEqual(uids);
  });

  it('escapes a comma, a semicolon and a backslash in text', () => {
    const ics = toIcs([item({ title: 'Cupa, Iarna; \\', location: 'Sala 1, Etaj 2' })], NOW, 'Ana');
    expect(unfolded(ics)).toContain('SUMMARY:Cupa\\, Iarna\\; \\\\');
    expect(unfolded(ics)).toContain('LOCATION:Sala 1\\, Etaj 2');
  });

  it('folds lines at 75 octets, never inside a character, and unfolding restores the text', () => {
    const title = 'Școala de patinaj artistic pentru începători cu antrenament îndelungat și bine pregătit';
    const ics = toIcs([item({ title })], NOW, 'Ana');
    for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    expect(ics).toMatch(/\r\n [^\r\n]/);
    expect(unfolded(ics)).toContain(`SUMMARY:${title}`);
  });

  it('an item without a time is an all-day event', () => {
    const ics = toIcs([item({ kind: 'concurs', title: 'Cupa', startTime: null, endTime: null })], NOW, 'Ana');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261121');
    expect(ics).not.toContain('DTEND');
  });
});
