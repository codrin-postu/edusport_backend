import { describe, expect, it } from 'vitest';
import type { AthletePayments } from '../../presence/money-api';
import { paymentsReadOnly } from '../athlete-money-view';

describe('athlete money tabs (5.7)', () => {

  it('payments are read-only as the server says', () => {
    const p = (readOnly: boolean): AthletePayments => ({ months: [], payments: [], hasEmail: false, readOnly });
    expect([paymentsReadOnly(p(true)), paymentsReadOnly(p(false))]).toEqual([true, false]);
  });
});
