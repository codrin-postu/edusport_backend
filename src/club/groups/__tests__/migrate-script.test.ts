import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = readFileSync(join(__dirname, '..', '..', '..', '..', 'scripts', 'migrate-groups-schedules.js'), 'utf8');

describe('migrate-groups-schedules.js (spec 4)', () => {
  it('has the six steps in order, dry run by default, actor migrare', () => {
    for (const step of ['group-names', 'coaches', 'program-public', 'school-series', 'link-events', 'retire-old-series']) expect(SCRIPT).toContain(`'${step}'`);
    expect(SCRIPT).toContain("process.argv.includes('--apply')");
    expect(SCRIPT).toContain("const ACTOR = 'migrare'");
  });

  it('reads the planners from dist and writes item by item', () => {
    expect(SCRIPT).toContain("require(`../dist/src/club/groups/${p}`)");
    expect(SCRIPT).toContain('async function writeEach');
    expect(SCRIPT).not.toMatch(/store\.transaction\(async \(\) => \{\s*for/);
  });

  it('never touches team_members.groups or program.scheduleGroups', () => {
    expect(SCRIPT).not.toMatch(/team-member[^\n]*update/);
    expect(SCRIPT).not.toMatch(/scheduleGroups\s*:/);
  });

  it('reports the one-main-per-season violators read-only, ids only, in every dry run', () => {
    expect(SCRIPT).toContain('planMainsViolations');
    expect(SCRIPT).toContain('if (!APPLY) await reportMains(ctx)');
    const mains = SCRIPT.slice(SCRIPT.indexOf('async function reportMains'), SCRIPT.indexOf('/** Strapi'));
    expect(mains).toContain('v.athleteId');
    expect(mains).not.toMatch(/name/i);
  });

  it('prints team member names (public staff) in the coaches plan and unmatched lines', () => {
    expect(SCRIPT).toMatch(/log\([^\n]*l\.teamMemberName/);
    expect(SCRIPT).toMatch(/log\([^\n]*u\.teamMemberName/);
    expect(SCRIPT).not.toMatch(/log\([^\n]*teamMemberId/);
  });

  it('loads the store inside the try and reminds the operator after an apply', () => {
    expect(SCRIPT.indexOf("lib('strapi-store')")).toBeGreaterThan(SCRIPT.indexOf('try {'));
    expect(SCRIPT).toContain('if (APPLY) log(');
  });
});
