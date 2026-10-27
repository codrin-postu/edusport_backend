import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const admin = (p: string) => readFileSync(join(__dirname, '..', '..', '..', 'admin', p), 'utf8');

describe('dashboard notice (3C spec 5)', () => {
  it('shows while the server says so, links to the list, hides for a Super Admin only', () => {
    const notice = admin('dashboard/PersonalDataNotice.tsx');
    for (const s of [
      'if (!summary?.shown) return null;', 'PERSONAL_DATA_COPY.notice(summary.count, summary.retentionYears)', 'navigate(inactiveListTo)',
      'PERSONAL_DATA_COPY.noticeLink', '{superAdmin && <Button', 'PERSONAL_DATA_COPY.noticeHide', 'await api.hideInactiveReview()', 'api.inactiveSummary()',
    ]) expect(notice, s).toContain(s);
    expect(notice).not.toMatch(/anonymize\(|anonymizeMany\(/);
  });

  it('sits on the dashboard under the KPI tiles', () => {
    const page = admin('dashboard/DashboardPage.tsx');
    expect(page).toContain("import { PersonalDataNotice } from './PersonalDataNotice';");
    expect(page.indexOf('<PersonalDataNotice />')).toBeGreaterThan(page.indexOf('dash-kpis'));
  });
});

describe('Setări site (3C spec 2)', () => {
  it('"Ani până la anonimizare": a number from 1 to 20, default 5, saved in personalData', () => {
    const page = admin('pages/SetariSitePage.tsx');
    for (const s of [
      'PERSONAL_DATA_COPY.settingsCard', 'PERSONAL_DATA_COPY.settingsField', '<NumberInput', 'min={RETENTION_BOUNDS.min}', 'max={RETENTION_BOUNDS.max}',
      'allowEmpty={false}', "form.set('personalData', { ...personalData, retentionYears: retentionYearsOf(next) })",
      'retentionYears: DEFAULT_RETENTION_YEARS',
    ]) expect(page, s).toContain(s);
  });
});
