import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..', '..');
const json = (p: string) => JSON.parse(readFileSync(join(SRC, p), 'utf8'));
const source = (p: string) => readFileSync(join(SRC, p), 'utf8');

const NEW = ['session', 'attendance', 'individual-lesson', 'subscription', 'payment'];

describe('phase 5 schemas', () => {
  it('every phase 5 type is private, hidden, without draft (3)', () => {
    for (const n of NEW) {
      const s = json(`api/${n}/content-types/${n}/schema.json`);
      expect(s.options).toEqual({ draftAndPublish: false });
      expect(s.pluginOptions).toEqual({ 'content-manager': { visible: false } });
      expect(source(`api/${n}/routes/${n}.ts`), n).toContain('{ only: [] }');
    }
  });

  it('tables are named as spec 3', () => {
    expect(NEW.map((n) => json(`api/${n}/content-types/${n}/schema.json`).collectionName))
      .toEqual(['club_sessions', 'club_attendances', 'club_individual_lessons', 'club_subscriptions', 'club_payments']);
  });

  it('session keys and enums (3.1)', () => {
    const a = json('api/session/content-types/session/schema.json').attributes;
    expect(a.occurrenceKey).toEqual({ type: 'string', unique: true });
    expect(a.source).toEqual({ type: 'enumeration', enum: ['schedule', 'added'], required: true });
    expect(a.durationMin).toEqual({ type: 'integer', required: true, min: 5, max: 600 });
    expect(a.coaches).toEqual({ type: 'relation', relation: 'manyToMany', target: 'api::team-member.team-member' });
    expect(a.outsideSchedule).toEqual({ type: 'boolean', default: false });
  });

  it('attendance billing, charges, audience (3.2)', () => {
    const a = json('api/attendance/content-types/attendance/schema.json').attributes;
    expect(a.uniqueKey).toEqual({ type: 'string', unique: true });
    expect(a.billing).toEqual({ type: 'enumeration', enum: ['slot', 'fara_abonament', 'club', 'inclus', 'fara_pret'], required: true });
    expect(a.charges).toEqual({ type: 'json' });
    expect(a.amount).toEqual({ type: 'decimal', default: 0 });
    expect(a.audience).toEqual({ type: 'enumeration', enum: ['member', 'nonMember'] });
  });

  it('lesson state and duration (3.3)', () => {
    const a = json('api/individual-lesson/content-types/individual-lesson/schema.json').attributes;
    expect(a.state).toEqual({ type: 'enumeration', enum: ['planned', 'saved'], required: true, default: 'planned' });
    expect(a.durationMin).toEqual({ type: 'integer', required: true, default: 50, min: 5, max: 600 });
    expect(a.present).toEqual({ type: 'boolean' });
  });

  it('subscription frozen fields and validIn (3.4)', () => {
    const a = json('api/subscription/content-types/subscription/schema.json').attributes;
    expect(a.validIn).toEqual({ type: 'relation', relation: 'manyToMany', target: 'api::price-list.price-list' });
    expect(a.slots).toEqual({ type: 'integer', required: true, min: 1 });
    expect(a.extendedWeeks).toEqual({ type: 'integer', default: 0, min: 0 });
    expect(a.cancelled).toEqual({ type: 'boolean', default: false });
  });

  it('payment purpose, method, acsBefore (3.5)', () => {
    const a = json('api/payment/content-types/payment/schema.json').attributes;
    expect(a.method).toEqual({ type: 'enumeration', enum: ['numerar', 'card', 'transfer'], required: true });
    expect(a.purpose).toEqual({ type: 'enumeration', enum: ['abonament', 'cotizatie', 'club_luna', 'lectie', 'altceva'], required: true });
    expect(a.acsBefore).toEqual({ type: 'enumeration', enum: ['da', 'nu', 'in_asteptare'] });
    expect(a.clubMonth).toEqual({ type: 'string', regex: '^\\d{4}-\\d{2}$' });
    expect(a.collectedAtRink).toEqual({ type: 'boolean', default: false });
    expect(a.amount).toEqual({ type: 'decimal', required: true, min: 0.01 });
  });

  it('e-mail jobs know payments; settings know the start date (3.7, 3.8)', () => {
    const j = json('api/email-job/content-types/email-job/schema.json').attributes;
    expect(j.kind.enum).toEqual(['registration', 'schedule-change', 'payment']);
    expect(j.payment).toEqual({ type: 'relation', relation: 'manyToOne', target: 'api::payment.payment' });
    expect(json('api/site-settings/content-types/site-settings/schema.json').attributes.attendanceStartDate).toEqual({ type: 'date' });
  });
});
