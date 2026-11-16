import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECURITY_COPY } from '../security/copy';
import { ANUNT_LIST_COPY } from '../anunturi/portal-history';

const src = (file: string): string => readFileSync(join(__dirname, '../../', file), 'utf8');
const PAGES = ['CursuriPage', 'RegulamentPage', 'RealizariPage', 'IstoricPage', 'PaginaEchipaPage', 'PaginaParteneriPage', 'EvenimentColaborareEditPage', 'EvenimenteColaborarePage', 'MomenteIstoricPage', 'DisciplinePage'];

describe('admin copy 3: Anunțuri, Setări, Securitate, Sheets, site editors', () => {
  it('uses the short save and error forms', () => {
    expect(src('admin/ui/useSaveState.ts')).toContain("adminToast.success('Salvat.')");
    expect(src('admin/lib/contentApi.ts')).toContain("new Error('Verifică câmpurile.')");
    for (const f of ['admin/dashboard/CompetitieEditPage.tsx', 'admin/dashboard/AnuntEditPage.tsx', 'admin/dashboard/SponsoriPage.tsx', 'admin/dashboard/MembriEchipaPage.tsx', 'admin/dashboard/sportivi/ProfileEditor.tsx']) {
      expect(src(f), f).toContain("'Nu s-a salvat. Verifică datele.'");
      expect(src(f), f).not.toContain('Salvarea a eșuat');
    }
    expect(src('admin/ui/useUnsavedGuard.tsx')).toContain("'Modificările nesalvate se pierd.'");
    expect(src('admin/dashboard/VoluntariPage.tsx')).toContain("'Ștergi cererea? Nu se poate anula.'");
    expect(src('admin/dashboard/AnuntEditPage.tsx')).toContain('se șterge. Nu se poate anula.');
    expect(src('admin/ui/RepeatableList.tsx')).toContain("'Se șterge la salvare.'");
    expect(src('admin/MobileNav.tsx')).toContain('Meniul nu s-a încărcat. Reîncarcă pagina.');
  });

  it('MesajePage has diacritics', () => {
    const s = src('admin/dashboard/MesajePage.tsx');
    expect(s).toContain('Ștergerea nu a reușit.');
    expect(s).toContain('Se șterge definitiv.');
    for (const bad of ['Stergerea', 'reusit', 'definitiva', 'Sterge', 'sterge ']) expect(s).not.toContain(bad);
  });

  it('removes hints under inputs', () => {
    const cursuri = src('admin/pages/CursuriPage.tsx');
    for (const gone of ['Titlul mare afișat pe banner-ul paginii', 'ex: Sâmbătă & Duminică\',', 'URL YouTube sau alt video', 'Textul final afișat după lista de sfaturi']) expect(cursuri).not.toContain(`hint: '${gone}`);
    expect(cursuri).not.toContain('hint="Textul final');
    expect(cursuri).not.toMatch(/hint: '/);
    const setari = src('admin/pages/SetariSitePage.tsx');
    for (const gone of ['link-ul tel:', 'Link către canalul de WhatsApp', 'Textul adresei care apare', 'Când este activ, pe site', 'Vizibile pe site']) expect(setari).not.toContain(gone);
    const sponsori = src('admin/dashboard/SponsoriPage.tsx');
    for (const gone of ['Se afișează în banda de sponsori', 'Lasă gol dacă logo-ul', 'Numărul mai mic apare primul']) expect(sponsori).not.toContain(gone);
    expect(src('admin/dashboard/MembriEchipaPage.tsx')).not.toContain('Apare sub nume');
    for (const p of PAGES) {
      const s = src(`admin/pages/${p}.tsx`).replace('description="Format: valoare|etichetă, câte una pe rând."', '');
      expect(s, p).not.toMatch(/\bsubtitle="/);
      expect(s, p).not.toMatch(/\bdescription="/);
      expect(s, p).not.toMatch(/\bhint: '/);
    }
    expect(src('admin/pages/IstoricPage.tsx')).toContain('description="Format: valoare|etichetă, câte una pe rând."');
    expect(src('admin/pages/sezoane/SeasonDrawer.tsx')).not.toContain('hint="RON"');
  });

  it('turns the maps link hint into a tip', () => {
    const tip = 'Gol: căutare Google Maps. Altfel lipește linkul din Partajează.';
    expect(src('admin/pages/SetariSitePage.tsx')).toContain(`<HelpTip label="${tip}" />`);
    expect(src('plugins/component-preview/admin/src/SiteSettingsContactEditor.tsx')).toContain(`<HelpTip label="${tip}" />`);
    expect(src('admin/pages/SetariSitePage.tsx')).not.toContain('Lasă gol și adresa');
  });

  it('locks reorder with a tip', () => {
    for (const f of ['admin/dashboard/SponsoriPage.tsx', 'admin/dashboard/MembriEchipaPage.tsx']) {
      expect(src(f), f).toContain('<HelpTip icon="lock" label="Golește căutarea ca să reordonezi." />');
      expect(src(f), f).not.toContain('pentru a putea reordona');
    }
    expect(ANUNT_LIST_COPY.autoNotStoppable).toBe('Automat, nu se poate opri.');
    expect(src('admin/dashboard/anunturi/AutoNoticeView.tsx')).toContain('<HelpTip icon="lock" label={copy.autoNotStoppable} />');
    expect(src('admin/dashboard/FormEditorPage.tsx')).toContain('<HelpTip icon="lock" label="Nu se mai schimbă." />');
  });

  it('shortens Anunțuri, Sheets, forms and Acasă', () => {
    const edit = src('admin/dashboard/AnuntEditPage.tsx');
    for (const t of ['Completează titlul.', 'Completează mesajul.', 'Alege data de început și de final.', 'Ca să nu mai apară, treci-l pe Inactiv.']) expect(edit).toContain(t);
    expect(edit).not.toContain('Id de urmărire');
    const list = src('admin/dashboard/AnunturiPage.tsx');
    expect(list).toContain("'Vizualizările nu s-au încărcat.'");
    expect(list).toContain("'Niciun anunț încă.'");
    expect(list).not.toContain('subtitle=');
    const sheets = src('admin/dashboard/SheetsDialog.tsx');
    for (const t of ['Foaie creată, dar nepartajată. Deschide-o din link.', 'Foaie deconectată.', 'Partajează foaia ca editor cu adresa:', 'Verificarea compară foaia cu baza de date și repară diferențele.']) expect(sheets).toContain(t);
    for (const gone of ['Se păstrează ultimele 20', 'Trimiterile sunt scrise automat', 'Creată de contul de serviciu']) expect(sheets).not.toContain(gone);
    const dash = src('admin/dashboard/DashboardPage.tsx');
    expect(dash).toContain('La zi');
    expect(dash).not.toContain('Lipsesc datele de acces');
    expect(dash).toContain('"Serviciul nu răspunde."');
    expect(src('admin/dashboard/FormularePage.tsx')).not.toContain('f.desc');
  });

  it('has no middle dot in the touched list and inbox rows', () => {
    for (const f of ['admin/dashboard/VoluntariPage.tsx', 'admin/dashboard/MesajePage.tsx', 'admin/dashboard/FormResultsPage.tsx', 'admin/dashboard/FormularePage.tsx']) {
      expect(src(f).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n'), f).not.toContain('·');
    }
  });

  it('keeps placeholders and has no banned characters', () => {
    const texts = [...Object.values(SECURITY_COPY.backup).filter((v) => typeof v === 'string'), SECURITY_COPY.google.confirmUnlink, ...Object.values(ANUNT_LIST_COPY).filter((v) => typeof v === 'string')] as string[];
    for (const t of texts) {
      expect(t).not.toMatch(/[–—·]/);
      expect(t).not.toMatch(/[“”‘’]/);
    }
    expect(SECURITY_COPY.backup.note).toBe('Fiecare cod merge o dată. Nu se mai afișează.');
    expect(SECURITY_COPY.google).not.toHaveProperty('hint');
    expect(SECURITY_COPY.backup.left(3)).toContain('3');
    expect(ANUNT_LIST_COPY.sentTo(2)).toContain('2');
  });
});
