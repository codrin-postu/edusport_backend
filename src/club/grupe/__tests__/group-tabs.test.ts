import { describe, expect, it } from 'vitest';
import type { GroupPage } from '../../groups/api-types';
import { groupTabs } from '../group-view';

const page = { members: [], historyCount: 0 } as unknown as GroupPage;

describe('group tabs', () => {
  it('lists Prezență while prezenta is on', () => {
    expect(groupTabs(page, () => true).map((t) => t.id)).toEqual(['sportivi', 'program', 'prezenta', 'istoric']);
  });
  it('drops Prezență when prezenta is off', () => {
    expect(groupTabs(page, (k) => k !== 'prezenta').map((t) => t.id)).toEqual(['sportivi', 'program', 'istoric']);
  });
});
