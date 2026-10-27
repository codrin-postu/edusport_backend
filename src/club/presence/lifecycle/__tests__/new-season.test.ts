import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { G_SEASONS } from '../../../groups/__tests__/fake-group-store';
import { seasonOfDate } from '../../dates';
import { subscriptionRow } from '../../__tests__/fake-store';
import { pickSubscription, subscriptionState } from '../../subscriptions';

const SRC = join(__dirname, '../../../..');

describe('new season (4.23)', () => {
  it('an abonament bought last season keeps working across the season change (4.23)', () => {
    const sub = subscriptionRow({ id: 'old', seasonId: 's26', startsOn: '2027-09-20', validUntil: '2027-10-17' });
    expect(seasonOfDate(G_SEASONS, '2027-10-05')?.id).toBe('s27');
    expect(pickSubscription([sub], new Map(), 'pl-std', '2027-10-05')?.id).toBe('old');
    expect(subscriptionState(sub, 3, '2027-10-05')).toBe('activ');
  });

  it('"Începe sezonul" reads and writes nothing of phase 5 (4.23)', () => {
    for (const file of readdirSync(join(SRC, 'club/groups/new-season'))) {
      const text = readFileSync(join(SRC, 'club/groups/new-season', file), 'utf8');
      expect(text, file).not.toMatch(/from '[^']*presence\//);
      expect(text, file).not.toMatch(/club_(sessions|attendances|individual_lessons|subscriptions|payments)/);
      expect(text, file).not.toMatch(/\.(create|update|delete)(Session|Attendance|Lesson|Subscription|Payment)\(/);
    }
  });
});
