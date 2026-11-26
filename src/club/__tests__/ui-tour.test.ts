import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { placeCard } from '../onboarding/placement';
import { welcomeRole } from '../onboarding/role';

const dir = join(__dirname, '../../admin/tour');
const read = (f: string) => readFileSync(join(dir, f), 'utf8');
const tourFiles = readdirSync(dir);

describe('tour sources', () => {
  it('TourRoot installs the guard only while a flow runs and restores fetch on exit and unmount', () => {
    const src = read('TourRoot.tsx');
    expect(src).toMatch(/next\.kind === 'flow'[^\n]*installFetchGuard/);
    expect(src).toMatch(/else uninstallFetchGuard\(\)/);
    expect(src).toMatch(/return \(\) => \{[^}]*uninstallFetchGuard\(\)/s);
    expect(src).toMatch(/capture|click', onClick, true/);
    expect(src).toMatch(/e\.preventDefault\(\);\s*e\.stopImmediatePropagation\(\)/);
    expect(src).toContain('!e.defaultPrevented');
    expect(src).toContain('querySelectorAll(anchorSelector');
  });

  it('the guard defaults the method, survives a throwing decide and clones the fixture per response', () => {
    const src = read('fetchGuard.ts');
    expect(src).toContain("'GET'");
    expect(src).toMatch(/try \{[\s\S]*decide\([\s\S]*\} catch/);
    expect(src).toContain('JSON.stringify(body)');
    expect(src).toContain('window.fetch = original');
    expect(src).toMatch(/if \(!life\.active\) return original/);
    expect(src).toMatch(/life\.active = false;[\s\S]*restore\?\.\(\)/);
  });

  it('TourCard renders where, ring, title, text, action, guide link, exit, and next only without waitFor', () => {
    const src = read('TourCard.tsx');
    for (const part of ['step.where', '<ProgressRing', 'step.title', 'step.text', 'step.action', 'TOUR_COPY.exit', 'TOUR_COPY.next']) expect(src).toContain(part);
    expect(src).toContain('${GHID_URL}/${step.guide}');
    expect(src).toMatch(/!step\.waitFor && /);
  });

  it('the anchor wait gives up after a ceiling and the footer row stays while a tour runs', () => {
    expect(read('useAnchor.ts')).toContain('WAIT_CEILING_MS');
    expect(read('FooterBadge.tsx')).toMatch(/visible: !allDone \|\| running/);
    expect(read('TourRoot.tsx')).toContain('setTourRunning(next.kind !== \'idle\')');
  });

  it('no tour file names Strapi', () => {
    const visible = (f: string) => read(f).split('\n').filter((l) => !/^\s*(import |\/\/|\/?\*)/.test(l)).join('\n');
    for (const f of tourFiles) expect(visible(f)).not.toMatch(/strapi/i);
  });

  it('ProgressRing is the only round shape of the tour folder', () => {
    for (const f of tourFiles) {
      const src = read(f);
      const round = /border-radius:\s*50%|<circle/.test(src);
      expect(round).toBe(f === 'ProgressRing.tsx');
    }
  });
});

describe('placement and role', () => {
  const vp = { width: 1000, height: 700 };
  const card = { width: 320, height: 200 };
  it('phone gets a bottom sheet', () => {
    expect(placeCard({ top: 10, left: 10, width: 50, height: 20 }, card, vp, true)).toEqual({ sheet: true });
  });
  it('card sits beside the target and stays inside the viewport', () => {
    const p = placeCard({ top: 300, left: 100, width: 100, height: 40 }, card, vp, false);
    expect(p).toMatchObject({ sheet: false, left: 214 });
    const edge = placeCard({ top: 650, left: 900, width: 90, height: 40 }, card, vp, false);
    if (edge.sheet) throw new Error('unexpected sheet');
    expect(edge.left + card.width).toBeLessThanOrEqual(vp.width);
    expect(edge.top + card.height).toBeLessThanOrEqual(vp.height);
  });
  it('welcome role: superAdmin, else club, else editor', () => {
    expect(welcomeRole((a) => a === 'superAdmin' || a === 'club')).toBe('superAdmin');
    expect(welcomeRole((a) => a === 'club')).toBe('club');
    expect(welcomeRole(() => false)).toBe('editor');
  });
});

describe('inscriere flow anchors', () => {
  const src = (f: string) => readFileSync(join(__dirname, '../../admin/dashboard', f), 'utf8');
  it('places the five anchors on the real elements', () => {
    expect(src('InscrieriPage.tsx')).toContain("'ins-maria'");
    expect(src('SubmissionTable.tsx')).toContain('data-tour={cfg.compact.rowAnchor?.(r)}');
    expect(src('inscrieri/RegistrationPanel.tsx')).toContain('data-tour="ins-confirma"');
    expect(src('inscrieri/confirm/AthletePart.tsx')).toContain('data-tour="ins-sportiv"');
    expect(src('inscrieri/confirm/SeasonPart.tsx')).toContain('data-tour="ins-grupa"');
    expect(src('inscrieri/ConfirmWindow.tsx')).toContain('data-tour="ins-confirma-final"');
  });
});
