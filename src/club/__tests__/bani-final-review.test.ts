import { afterEach, describe, expect, it, vi } from 'vitest';
import { visibleGroups } from '../bani/money-view';
import { NO_GROUP } from '../money/types';
import { downloadGet } from '../../admin/dashboard/inscrieri/downloadPdf';

const m = (due: number, paid: number) => ({ due, paid, left: due - paid, percent: due === 0 ? null : Math.round((paid / due) * 100) });

describe('final review fixes (11-5)', () => {
  it('F9: the group row is hidden by the Fără grupă key, not by a label', () => {
    const g = [{ groupId: 'a', groupName: 'Club', totals: m(0, 0) }];
    expect(visibleGroups({ sectionId: 's1', sectionName: 'Club', groups: g })).toEqual(g);
    expect(visibleGroups({ sectionId: NO_GROUP, sectionName: 'Fără grupă', groups: [{ groupId: NO_GROUP, groupName: 'Fără grupă', totals: m(0, 0) }] })).toEqual([]);
  });
  describe('F6: a failed token refresh ends the session', () => {
    afterEach(() => vi.unstubAllGlobals());
    it('calls onSessionExpired and rethrows', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
      const refresh = vi.fn(async () => { throw new Error('expired'); });
      const onSessionExpired = vi.fn();
      await expect(downloadGet('t', '/x', 'f.csv', { refresh, onSessionExpired })).rejects.toThrow('expired');
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
    });
  });
});
