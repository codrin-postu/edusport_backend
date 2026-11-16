import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GRUPE_COPY } from '../groups/copy';
import { subtitle } from '../grupe/group-view';
import type { GroupPage } from '../groups/api-types';

const page = {
  section: { name: 'Școala de patinaj' },
  members: [{}, {}],
  coaches: [{ documentId: 'a', name: 'Ana Pop' }, { documentId: 'b', name: 'Dan Ion' }],
} as unknown as GroupPage;
const gp = readFileSync(join(__dirname, '../../admin/dashboard/grupe/GroupPage.tsx'), 'utf8');

describe('group page coaches row', () => {
  it('subtitle has section and athlete count, no coach names', () => {
    const s = subtitle(page);
    expect(s).toContain('Școala de patinaj');
    expect(s).toContain('2');
    expect(s).not.toContain('Ana Pop');
    expect(s).not.toContain('Dan Ion');
  });
  it('GroupPage renders a labelled coaches row with names opening the account block, and the empty copy', () => {
    expect(GRUPE_COPY.fieldCoaches).toBe('Antrenori');
    expect(gp).toContain('GRUPE_COPY.fieldCoaches');
    expect(gp).toContain('GRUPE_COPY.noCoach');
    expect(gp).toContain('<AccountBlock');
    expect(gp).toContain('preturiTo(');
  });
});
