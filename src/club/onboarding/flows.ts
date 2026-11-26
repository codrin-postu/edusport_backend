import type { AdminArea } from '../admin-area';
import type { FeatureKey } from '../features/features';
import { visibleLinks, type GatedLink } from '../features/visible';
import { PREZENTA_PATH } from '../prezenta/routes';

/** The guided flows of the admin tour, in menu order. */
export const FLOW_IDS = [
  'inscriere', 'sportiv', 'grupa', 'prezenta', 'plata', 'sedinta', 'anunt', 'parinte', 'functii', 'pagina', 'preturi', 'membru',
] as const;

export type FlowId = (typeof FLOW_IDS)[number];

export const isFlowId = (v: unknown): v is FlowId => typeof v === 'string' && (FLOW_IDS as readonly string[]).includes(v);

export interface TourStep {
  anchor: string;
  path?: string;
  where: string;
  title: string;
  text?: string;
  action?: string;
  waitFor?: 'click' | 'change';
  final?: true;
  guide?: string;
}

export interface FlowDef extends GatedLink {
  id: FlowId;
  name: string;
  editorOnly?: true;
  /** null = not built yet, never listed. */
  steps: TourStep[] | null;
}

// INSCRIERI_TO and ANUNTURI_TO live in the React file src/admin/dashboard/menu.tsx, so the strings are inlined here.
const INSCRIERI_PATH = '/plugins/edusport-inscrieri';
const ANUNTURI_PATH = '/plugins/edusport-anunturi';

export const INTRO_STEPS: TourStep[] = [
  {
    anchor: 'primii-pasi',
    where: 'Primii pași',
    title: 'Primii pași',
    text: 'Exersează sarcinile de bază pe date de exemplu, fără să modifici nimic în panou.',
  },
  {
    anchor: 'ghid',
    where: 'Ghidul EduSport',
    title: 'Ghidul EduSport',
    text: 'Pentru pași detaliați despre orice funcție, deschide ghidul. Îl găsești mereu aici.',
  },
];

const INSCRIERE_STEPS: TourStep[] = [
  { anchor: 'ins-maria', path: INSCRIERI_PATH, where: 'Înscrieri', title: 'Cereri noi', text: 'Aici ajung cererile trimise de părinți prin formularul de pe site.', action: 'Deschide înscrierea Mariei Popescu.', waitFor: 'click' },
  { anchor: 'ins-confirma', where: 'Înscrieri', title: 'Verifică datele', text: 'Citește ce a completat părintele înainte să confirmi.', action: 'Apasă Confirmă înscrierea.', waitFor: 'click' },
  { anchor: 'ins-sportiv', where: 'Înscrieri', title: 'Sportiv nou sau existent', text: 'Dacă sportivul are deja fișă în panou, alege Sportiv existent, ca să nu apară de două ori.', action: 'Alege una dintre variante.', waitFor: 'change' },
  { anchor: 'ins-grupa', where: 'Înscrieri', title: 'Alege grupa', text: 'Selectează grupa în care începe. Dacă nu e stabilită încă, o poți adăuga mai târziu.' },
  { anchor: 'ins-confirma-final', where: 'Înscrieri', title: 'Confirmă înscrierea', text: 'După confirmare, sportivul apare în Sportivi, cu fișa lui.', action: 'Apasă Confirmă înscrierea.', waitFor: 'click', final: true, guide: 'confirma-o-inscriere' },
];

const PREZENTA_STEPS: TourStep[] = [
  { anchor: 'ses-1', path: PREZENTA_PATH, where: 'Prezență', title: 'Ședințe de completat', text: 'Aici găsești ședințele la care prezența nu a fost trecută încă.', action: 'Deschide ședința de luni.', waitFor: 'click' },
  { anchor: 'ses-antrenor', where: 'Prezență', title: 'Verifică antrenorul', text: 'Asigură-te că este trecut antrenorul care a ținut ședința. Poți adăuga și un al doilea.' },
  { anchor: 'ses-lista', where: 'Prezență', title: 'Bifează prezenții', text: 'Bifează Grup pentru fiecare sportiv prezent. Sub nume vezi câte ședințe mai are în abonament.' },
  { anchor: 'ses-salveaza', where: 'Prezență', title: 'Salvează prezența', text: 'Prezența se reflectă în abonamente și plăți, așa că verifică lista înainte de salvare.', action: 'Apasă Salvează.', waitFor: 'click', final: true, guide: 'completeaza-prezenta' },
];

const ANUNT_STEPS: TourStep[] = [
  { anchor: 'anunt-nou', path: ANUNTURI_PATH, where: 'Anunțuri', title: 'Creează un anunț', text: 'Anunță o competiție, o schimbare de program sau orice noutate pentru părinți și sportivi.', action: 'Apasă + Anunț nou.', waitFor: 'click' },
  { anchor: 'unde', where: 'Anunțuri', title: 'Alege unde apare', text: 'Anunțul poate apărea pe site, în portalul sportivilor sau în ambele locuri.' },
  { anchor: 'pentru', where: 'Anunțuri', title: 'Alege destinatarii', text: 'Trimite-l tuturor grupelor sau doar celor vizate, de exemplu unei grupe cu ședința anulată.' },
  { anchor: 'text', where: 'Anunțuri', title: 'Scrie mesajul', text: 'Un titlu clar și un mesaj scurt: ce s-a schimbat și ce trebuie făcut.' },
  { anchor: 'programare', where: 'Anunțuri', title: 'Stabilește perioada', text: 'Alege de când și până când este afișat. După ultima zi, dispare automat.' },
  { anchor: 'anunt-salveaza', where: 'Anunțuri', title: 'Publică anunțul', text: 'La salvare, anunțul devine vizibil acolo unde l-ai trimis.', action: 'Apasă Salvează.', waitFor: 'click', final: true, guide: 'anunturi' },
];

export const FLOWS: FlowDef[] = [
  { id: 'inscriere', name: 'Confirmă o înscriere', area: 'club', steps: INSCRIERE_STEPS },
  { id: 'sportiv', name: 'Adaugă un sportiv', area: 'club', steps: null },
  { id: 'grupa', name: 'Creează o grupă', area: 'club', steps: null },
  { id: 'prezenta', name: 'Completează prezența', area: 'club', feature: 'prezenta', steps: PREZENTA_STEPS },
  { id: 'plata', name: 'Înregistrează o plată', area: 'club', feature: 'abonamente', steps: null },
  { id: 'sedinta', name: 'Anulează sau mută o ședință', area: 'club', steps: null },
  { id: 'anunt', name: 'Scrie un anunț', area: 'website', steps: ANUNT_STEPS },
  { id: 'parinte', name: 'Invită un părinte în portal', area: 'club', feature: 'portalParinti', steps: null },
  { id: 'functii', name: 'Pornește sau oprește o funcție', area: 'superAdmin', steps: null },
  { id: 'pagina', name: 'Modifică o pagină', area: 'website', editorOnly: true, steps: null },
  { id: 'preturi', name: 'Actualizează prețurile', area: 'website', editorOnly: true, steps: null },
  { id: 'membru', name: 'Adaugă un membru în echipă', area: 'website', editorOnly: true, steps: null },
];

/** The built flows a caller may start: area and switch allow it, and editor-only flows are hidden from club admins. */
export function flowsFor(has: (a: AdminArea) => boolean, on: (k: FeatureKey) => boolean): FlowDef[] {
  return visibleLinks(FLOWS, has, on).filter((f) => f.steps !== null && !(f.editorOnly && has('club')));
}
