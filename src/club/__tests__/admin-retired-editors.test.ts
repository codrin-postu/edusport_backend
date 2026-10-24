import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const SRC = join(__dirname, '..', '..');
const source = (p: string) => readFileSync(join(SRC, p), 'utf8');

it('Setări site and its content-manager editor no longer edit the season', () => {
  for (const file of ['admin/pages/SetariSitePage.tsx', 'plugins/component-preview/admin/src/SiteSettingsRegistrationEditor.tsx']) {
    const code = source(file);
    expect(code, file).not.toMatch(/DateRangeInput|DatePicker|seasonStartDate:|currentSeason:/);
    expect(code, file).toContain('Înscrieri deschise');
  }
});

it('the old pricing tiers editor is gone; the pricing data stays a json attribute', () => {
  expect(existsSync(join(SRC, 'plugins/component-preview/admin/src/PricingTiersEditor.tsx'))).toBe(false);
  expect(source('plugins/component-preview/admin/src/index.ts')).not.toContain('pricing-tiers');
  const tiers = JSON.parse(source('api/pricing/content-types/pricing/schema.json')).attributes.tiers;
  expect(tiers.type).toBe('json');
  expect(tiers.customField).toBeUndefined();
});
