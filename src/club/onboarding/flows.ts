import type { AdminArea } from '../admin-area';
import type { FeatureKey } from '../features/features';
import { visibleLinks, type GatedLink } from '../features/visible';
import { contabTo } from '../contabilitate/routes';
import { GRUPE_COPY } from '../groups/copy';
import { GRUPE_PATH, groupPageTo } from '../grupe/routes';
import { prezentaTo } from '../prezenta/routes';
import { SPORTIVI_PATH } from '../sportivi/routes';

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
  /** A click advances only on the radio option with this label (the Ține / Anulează / Mută choice waits for Anulează). */
  pick?: string;
  guide?: string;
  /** The step is dropped while this switch is off (its control is not on the page then). */
  feature?: FeatureKey;
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
    where: 'Meniul din stânga, jos',
    title: 'Primii pași',
    text: 'Exersează sarcinile de bază pe date de exemplu, fără să modifici nimic în panou.',
  },
  {
    anchor: 'ghid',
    where: 'Meniul din stânga, jos',
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
  { anchor: 'ses-1', path: prezentaTo({ tab: 'de-completat' }), where: 'Prezență', title: 'Ședințe de completat', text: 'Aici găsești ședințele la care prezența nu a fost trecută încă.', action: 'Deschide ședința de luni.', waitFor: 'click' },
  { anchor: 'ses-antrenor', where: 'Prezență', title: 'Verifică antrenorul', text: 'Asigură-te că este trecut antrenorul care a ținut ședința. Poți adăuga și un al doilea.' },
  { anchor: 'ses-lista', where: 'Prezență', title: 'Bifează prezenții', text: 'Bifează Grup pentru fiecare sportiv prezent. Sub nume vezi câte ședințe mai are în abonament.' },
  { anchor: 'ses-salveaza', where: 'Prezență', title: 'Salvează prezența', text: 'Prezența se reflectă în abonamente și plăți, așa că verifică lista înainte de salvare.', action: 'Apasă Salvează.', waitFor: 'click', final: true, guide: 'completeaza-prezenta' },
];

const ANUNT_STEPS: TourStep[] = [
  { anchor: 'anunt-nou', path: ANUNTURI_PATH, where: 'Anunțuri', title: 'Creează un anunț', text: 'Anunță o competiție, o schimbare de program sau orice noutate pentru părinți și sportivi.', action: 'Apasă + Anunț nou.', waitFor: 'click' },
  { anchor: 'unde', where: 'Anunțuri', title: 'Alege unde apare', text: 'Anunțul poate apărea pe site, în portalul sportivilor sau în ambele locuri.' },
  { anchor: 'pentru', feature: 'portalParinti', where: 'Anunțuri', title: 'Alege destinatarii', text: 'Trimite-l tuturor grupelor sau doar celor vizate, de exemplu unei grupe cu ședința anulată.' },
  { anchor: 'text', where: 'Anunțuri', title: 'Scrie mesajul', text: 'Un titlu clar și un mesaj scurt: ce s-a schimbat și ce trebuie făcut.' },
  { anchor: 'programare', where: 'Anunțuri', title: 'Stabilește perioada', text: 'Alege de când și până când este afișat. După ultima zi, dispare automat.' },
  { anchor: 'anunt-salveaza', where: 'Anunțuri', title: 'Publică anunțul', text: 'La salvare, anunțul devine vizibil acolo unde l-ai trimis.', action: 'Apasă Salvează.', waitFor: 'click', final: true, guide: 'anunturi' },
];

const SPORTIV_STEPS: TourStep[] = [
  { anchor: 'sp-adauga', path: SPORTIVI_PATH, where: 'Sportivi', title: 'Adaugă un sportiv', text: 'Adaugă manual un sportiv care nu a venit printr-o înscriere de pe site.', action: 'Apasă Adaugă sportiv.', waitFor: 'click' },
  { anchor: 'sp-cauta', where: 'Sportivi', title: 'Caută mai întâi', text: 'Scrie numele. Dacă sportivul apare în listă, deschide-i fișa, ca să nu creezi una nouă.', action: 'Scrie un nume.', waitFor: 'change' },
  { anchor: 'sp-nou', where: 'Sportivi', title: 'Sportiv nou', text: 'Dacă nu îl găsești, alege Sportiv nou, sub rezultate.', action: 'Apasă Sportiv nou.', waitFor: 'click' },
  { anchor: 'sp-date', where: 'Sportivi', title: 'Completează datele', text: 'Numele complet și data nașterii sunt obligatorii. Contactul părintelui îl poți adăuga și mai târziu.' },
  { anchor: 'sp-final', where: 'Sportivi', title: 'Salvează fișa', text: 'După salvare se deschide fișa noului sportiv.', action: 'Apasă Adaugă sportiv.', waitFor: 'click', final: true, guide: 'adauga-un-sportiv' },
];

const GRUPA_STEPS: TourStep[] = [
  { anchor: 'gr-sezon', path: GRUPE_PATH, where: 'Grupe', title: 'Alege sezonul', text: 'Grupele sunt pe sezoane. Verifică sezonul și secțiunea înainte să adaugi una nouă.' },
  { anchor: 'gr-nou', where: 'Grupe', title: 'Grupă nouă', text: 'Fiecare grupă are antrenori, o listă de prețuri și un program.', action: 'Apasă Grupă nouă.', waitFor: 'click' },
  { anchor: 'gr-date', where: 'Grupe', title: 'Datele grupei', text: 'Scrie numele și alege lista de prețuri și antrenorii, dacă sunt stabiliți.' },
  { anchor: 'gr-public', where: 'Grupe', title: 'Program public', text: 'Dacă e pornit, programul grupei apare în orarul de pe site.' },
  { anchor: 'gr-final', where: 'Grupe', title: 'Creează grupa', text: 'După creare, adaugi orele în tabul Program.', action: 'Apasă Creează grupa.', waitFor: 'click', final: true, guide: 'creeaza-o-grupa' },
];

/** The example group and Thursday date of the "Anulează sau mută o ședință" flow (fixtures.ts serves them). */
export const EXAMPLE_GROUP_ID = 'ex-grupa-1';

const PLATA_STEPS: TourStep[] = [
  { anchor: 'pl-plata', path: contabTo({ tab: 'plati' }), where: 'Contabilitate', title: 'Plată nouă', text: 'Plățile se trec din Contabilitate sau direct din fișa sportivului.', action: 'Apasă + Plată.', waitFor: 'click' },
  { anchor: 'pl-sportiv', where: 'Contabilitate', title: 'Sportiv și motiv', text: 'Alege sportivul, apoi ce plătește: abonament, cotizație, lecție individuală sau altceva.' },
  { anchor: 'pl-suma', where: 'Contabilitate', title: 'Suma și metoda', text: 'Suma se completează automat când e cunoscută. Verifică data și alege metoda de plată.' },
  { anchor: 'pl-final', where: 'Contabilitate', title: 'Înregistrează plata', text: 'Plata apare imediat în fișa sportivului și în Contabilitate.', action: 'Apasă Înregistrează.', waitFor: 'click', final: true, guide: 'inregistreaza-o-plata' },
];

const SEDINTA_STEPS: TourStep[] = [
  { anchor: 'se-data', path: groupPageTo(EXAMPLE_GROUP_ID, null, 'program'), where: 'Grupe', title: 'Alege ședința', text: 'Deschide grupa, tabul Program, și apasă data din calendar.', action: 'Apasă pe data de joi.', waitFor: 'click' },
  { anchor: 'se-alege', where: 'Grupe', title: 'Anulează sau mută', text: 'Alege ce se întâmplă cu ședința: rămâne, se anulează sau se mută în altă zi.', action: 'Alege Anulează.', waitFor: 'click', pick: GRUPE_COPY.cancelDate },
  { anchor: 'se-motiv', where: 'Grupe', title: 'Scrie motivul', text: 'Scrie pe scurt de ce se anulează sau se mută ședința.' },
  { anchor: 'se-anunta', where: 'Grupe', title: 'Anunță părinții', text: 'Bifează opțiunea ca părinții să primească un e-mail despre schimbare.' },
  { anchor: 'se-final', where: 'Grupe', title: 'Salvează', text: 'Ședința apare anulată sau mutată în calendarul grupei și în portal.', action: 'Apasă Salvează.', waitFor: 'click', final: true, guide: 'anuleaza-sau-muta-o-sedinta' },
];

export const FLOWS: FlowDef[] = [
  { id: 'inscriere', name: 'Confirmă o înscriere', area: 'club', steps: INSCRIERE_STEPS },
  { id: 'sportiv', name: 'Adaugă un sportiv', area: 'club', steps: SPORTIV_STEPS },
  { id: 'grupa', name: 'Creează o grupă', area: 'club', steps: GRUPA_STEPS },
  { id: 'prezenta', name: 'Completează prezența', area: 'club', feature: 'prezenta', steps: PREZENTA_STEPS },
  { id: 'plata', name: 'Înregistrează o plată', area: 'club', feature: 'abonamente', steps: PLATA_STEPS },
  { id: 'sedinta', name: 'Anulează sau mută o ședință', area: 'club', steps: SEDINTA_STEPS },
  { id: 'anunt', name: 'Scrie un anunț', area: 'website', steps: ANUNT_STEPS },
  { id: 'parinte', name: 'Invită un părinte în portal', area: 'club', feature: 'portalParinti', steps: null },
  { id: 'functii', name: 'Pornește sau oprește o funcție', area: 'superAdmin', steps: null },
  { id: 'pagina', name: 'Modifică o pagină', area: 'website', editorOnly: true, steps: null },
  { id: 'preturi', name: 'Actualizează prețurile', area: 'website', editorOnly: true, steps: null },
  { id: 'membru', name: 'Adaugă un membru în echipă', area: 'website', editorOnly: true, steps: null },
];

/** The steps whose switch is on; steps without a `feature` always stay. */
export const stepsFor = (steps: TourStep[], on: (k: FeatureKey) => boolean): TourStep[] => steps.filter((s) => !s.feature || on(s.feature));

/** The built flows a caller may start: area and switch allow it, and editor-only flows are hidden from club admins. */
export function flowsFor(has: (a: AdminArea) => boolean, on: (k: FeatureKey) => boolean): FlowDef[] {
  return visibleLinks(FLOWS, has, on).filter((f) => f.steps !== null && !(f.editorOnly && has('club')));
}
