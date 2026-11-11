import { expect, it } from 'vitest';
import { withExpectedName } from '../../admin/pages/preturi/format';

it('the delete URL reads back the exact name' + ' (table)', () => {
  const __each = (name) => {
  const url = new URL(withExpectedName('/api/club/admin/price-lists/abc/items/3', name), 'https://cms.example.ro');
  expect(url.pathname).toBe('/api/club/admin/price-lists/abc/items/3');
  expect(url.searchParams.get('expectedName')).toBe(name);
  expect([...url.searchParams.keys()]).toEqual(['expectedName']);
};
  for (const row of ['Abonament 8 ședințe & echipament', 'Grupa 1+1', 'Lecție #2', 'Reducere 10%', 'a=b?c'] as unknown[]) {
    try {
      (__each as (...a: unknown[]) => unknown)(...(Array.isArray(row) ? row : [row]));
    } catch (e) {
      throw new Error(`row ${JSON.stringify(row)}: ${(e as Error).message}`);
    }
  }
});
