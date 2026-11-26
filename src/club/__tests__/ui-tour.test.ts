import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { placeCard } from '../onboarding/placement';
import { rowAnchor, welcomeRole } from '../onboarding/role';
import { CURSURI_TO } from '../../admin/pages/routes';

const dir = join(__dirname, '../../admin/tour');
const read = (f: string) => readFileSync(join(dir, f), 'utf8');
const tourFiles = readdirSync(dir);

describe('tour sources', () => {
  it('TourRoot installs the guard only while a flow runs and restores fetch on exit and unmount', () => {
    const src = read('TourRoot.tsx');
    expect(src).toMatch(/next\.kind === 'flow' && next\.flow\) \{\s*installs \+= 1;\s*installFetchGuard/);
    expect(src).toMatch(/uninstallAfterRoute\(\)/);
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
    expect(src('SubmissionTable.tsx')).toContain('rowAnchor={cfg.compact.rowAnchor}');
    expect(src('inscrieri/PhoneList.tsx')).toContain('data-tour={rowAnchor?.(r)}');
    expect(src('inscrieri/RegistrationPanel.tsx')).toContain('data-tour="ins-confirma"');
    expect(src('inscrieri/confirm/AthletePart.tsx')).toContain('data-tour="ins-sportiv"');
    expect(src('inscrieri/confirm/SeasonPart.tsx')).toContain('data-tour="ins-grupa"');
    expect(src('inscrieri/ConfirmWindow.tsx')).toContain('data-tour="ins-confirma-final"');
  });
  it('places the four prezenta anchors, inert outside the example session', () => {
    expect(src('prezenta/UndoneTab.tsx')).toContain("'ses-1'");
    expect(src('prezenta/PeriodTable.tsx')).toContain('data-tour={rowAnchor?.(r)}');
    expect(src('prezenta/SessionPanel.tsx')).toContain("tourOf(panel, 'ses-antrenor')");
    expect(src('prezenta/SessionPanel.tsx')).toContain("tourOf(panel, 'ses-lista')");
    expect(src('prezenta/SessionPanel.tsx')).toContain("tourOf(panel, 'ses-salveaza')");
  });
  it('places the anunt anchors, inert outside the example', () => {
    expect(src('AnunturiPage.tsx')).toContain("isExampleAnunt(r.id)) ? 'anunt-nou'");
    for (const a of ['unde', 'pentru', 'text', 'programare']) expect(src('AnuntEditPage.tsx')).toContain(`tour('${a}')`);
    expect(src('AnuntEditPage.tsx')).toContain("saveTour={tour('anunt-salveaza')}");
    expect(src('AnuntEditPage.tsx')).toContain('when={form.dirty && !example}');
    const view = readFileSync(join(__dirname, '../../admin/ui/SaveBarView.tsx'), 'utf8');
    expect(view).toMatch(/<button[^>]*ui-savebar-btn--primary[^>]*data-tour=\{saveTour\}[^>]*>/s);
    expect(readFileSync(join(__dirname, '../../admin/ui/SaveBar.tsx'), 'utf8')).toContain('saveTour={saveTour}');
  });
  it('places the sportiv and grupa anchors', () => {
    expect(src('sportivi/SportiviList.tsx')).toContain('data-tour="sp-adauga"');
    expect(src('sportivi/AthleteSearch.tsx')).toContain('data-tour="sp-cauta"');
    expect(src('sportivi/AthleteSearch.tsx')).toContain("o.key === '' ? 'sp-nou'");
    expect(src('sportivi/AddAthleteDialog.tsx')).toContain('data-tour="sp-date"');
    expect(src('sportivi/AddAthleteDialog.tsx')).toContain('data-tour="sp-final"');
    expect(src('grupe/GrupeList.tsx')).toContain('data-tour="gr-sezon"');
    expect(src('grupe/GrupeList.tsx')).toContain('data-tour="gr-nou"');
    for (const a of ['gr-date', 'gr-public']) expect(src('grupe/GroupDialog.tsx')).toContain(`data-tour="${a}"`);
    expect(src('grupe/GroupDialog.tsx')).toContain("props.mode === 'new' ? 'gr-final'");
  });
  it('places the plata and sedinta anchors, inert outside the example', () => {
    expect(src('bani/PlatiList.tsx')).toContain('data-tour="pl-plata"');
    for (const a of ['pl-sportiv', 'pl-suma']) expect(src('bani/PaymentWindow.tsx')).toContain(`data-tour="${a}"`);
    expect(src('bani/PaymentWindow.tsx')).toContain("mode === 'new' ? 'pl-final'");
    for (const a of ['se-alege', 'se-motiv', 'se-anunta', 'se-final']) expect(src('grupe/DatePanel.tsx')).toContain(`data-tour="${a}"`);
    expect(src('grupe/GroupCalendar.tsx')).toContain("isExampleDate(o.documentId) ? 'se-data'");
    expect(readFileSync(join(__dirname, '../../plugins/component-preview/admin/src/calendar/CalendarView.tsx'), 'utf8').match(/anchor=\{chipAnchor\?\.\(o\)\}/g)).toHaveLength(3);
  });
  it('places the parinte and functii anchors, inert outside the example', () => {
    expect(src('sportivi/AthleteTable.tsx')).toContain("isExampleInvitee(row.documentId) ? 'pa-sportiv'");
    expect(src('sportivi/AthleteCards.tsx')).toContain("isExampleInvitee(r.documentId) ? 'pa-sportiv'");
    expect(src('sportivi/AccessBlock.tsx')).toContain("isExampleInvitee(athleteId) ? 'pa-acces'");
    expect(src('sportivi/AccessBlock.tsx')).toContain("'pa-invita'");
    expect(readFileSync(join(__dirname, '../../admin/pages/FunctiiPage.tsx'), 'utf8')).toContain('tour="fu-lista"');
    expect(readFileSync(join(__dirname, '../../admin/pages/FunctiiPage.tsx'), 'utf8')).toContain("row.key === 'parcurs' ? 'fu-parcurs'");
  });
  it('places the editor flow anchors', () => {
    const adm = (f: string) => readFileSync(join(__dirname, '../../admin', f), 'utf8');
    expect(adm('pages/CursuriPage.tsx')).toContain('tour="pg-text"');
    expect(adm('pages/CursuriPage.tsx')).toContain('saveTour="pg-salveaza"');
    expect(adm('dashboard/EdusportShell.tsx')).toContain('data-tour={rowAnchor(l.to)}');
    expect(adm('MobileNav.tsx')).toContain('tour: rowAnchor(l.to)');
    expect(adm('pages/preturi/PriceListCard.tsx')).toContain("isExamplePriceList(list.documentId) && r.index === 0");
    expect(adm('pages/preturi/PriceItemDrawer.tsx')).toContain('data-tour="pr-valori"');
    expect(adm('pages/preturi/PriceItemDrawer.tsx')).toContain("tour ? 'pr-salveaza'");
    expect(adm('dashboard/MembriEchipaPage.tsx')).toContain('data-tour="me-adauga"');
    expect(adm('dashboard/MembriEchipaPage.tsx')).toContain('data-tour="me-date"');
    expect(adm('dashboard/MembriEchipaPage.tsx')).toContain('data-tour="me-salveaza"');
  });
  it('the Cursuri row anchor matches the route', () => {
    expect(rowAnchor(CURSURI_TO)).toBe('row-cursuri');
    expect(rowAnchor('/plugins/edusport-preturi')).toBeUndefined();
  });
  it('the Anulează step advances only on its radio option', () => {
    const root = readFileSync(join(dir, 'TourRoot.tsx'), 'utf8');
    expect(root).toContain("closest('[role=\"radio\"]')");
    expect(root).toContain('!picked(e, step.pick)');
  });
  it('typing in an anchored text field advances a change step', () => {
    expect(readFileSync(join(dir, 'TourRoot.tsx'), 'utf8')).toContain("document.addEventListener('input', onChange, true)");
  });
});
