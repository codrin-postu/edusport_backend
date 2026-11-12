import { describe, expect, it } from 'vitest';
import { READY_MADE, readyMadeFor } from '../ready-made';
import { railGroups, railMenuKeys } from '../rail';
import type { SavedViewRow } from '../types';

const own = (id: string, mine: boolean): SavedViewRow => ({ id, name: id, subject: 'plati', definition: null, authorId: '1', authorName: 'Ana', mine, canDelete: mine, readyMade: false });

describe('ready-made list', () => {
  it('lists the five views in order and keeps the two old ones resolvable', () => {
    const listed = railGroups(READY_MADE)[0].views.map((v) => v.id);
    expect(listed).toEqual(['rm-plati-grupa', 'rm-prezenta-grupa', 'rm-ramas', 'rm-expira', 'rm-contacte']);
    const ids = readyMadeFor('s1').map((v) => v.id);
    expect(ids).toContain('rm-sportivi-activi');
    expect(ids).toContain('rm-sportivi-plati');
    expect(readyMadeFor('s1').find((v) => v.id === 'rm-sportivi-activi')?.listed).toBe(false);
  });
});

describe('railGroups', () => {
  it('puts own views in mele and the others in colegi', () => {
    const groups = railGroups([...READY_MADE, own('a', true), own('b', false)]);
    expect(groups.map((g) => g.key)).toEqual(['gata', 'mele', 'colegi']);
    expect(groups[1].views.map((v) => v.id)).toEqual(['a']);
    expect(groups[2].views.map((v) => v.id)).toEqual(['b']);
  });
  it('omits colegi when empty, keeps an empty mele, and omits unlisted ready-made views', () => {
    const groups = railGroups([...READY_MADE, own('a', true)]);
    expect(groups.map((g) => g.key)).toEqual(['gata', 'mele']);
    expect(groups[0].views.map((v) => v.id)).not.toContain('rm-sportivi-activi');
    expect(railGroups([]).map((g) => g.key)).toEqual(['gata', 'mele']);
  });
});

describe('railMenuKeys', () => {
  it('gives system views none, own views all three, colleagues only what the server allows', () => {
    expect(railMenuKeys(READY_MADE[0])).toEqual([]);
    expect(railMenuKeys(own('a', true))).toEqual(['rename', 'duplicate', 'remove']);
    expect(railMenuKeys(own('b', false))).toEqual([]);
    expect(railMenuKeys({ ...own('b', false), canDelete: true })).toEqual(['duplicate', 'remove']);
    expect(railMenuKeys({ ...own('c', true), broken: true })).toEqual(['remove']);
  });
});
