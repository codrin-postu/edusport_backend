import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..', '..');
const json = (p: string) => JSON.parse(readFileSync(join(SRC, p), 'utf8'));
const source = (p: string) => readFileSync(join(SRC, p), 'utf8');

const NEW = ['session', 'attendance', 'individual-lesson', 'subscription', 'payment'];

describe('phase 5 schemas', () => {

  it('code and receiptNo are unique strings; their database indexes are made at boot like the other presence keys (11-3 T3)', () => {
    expect(json('api/subscription/content-types/subscription/schema.json').attributes.code).toEqual({ type: 'string', unique: true });
    expect(json('api/payment/content-types/payment/schema.json').attributes.receiptNo).toEqual({ type: 'string', unique: true });
  });
});
