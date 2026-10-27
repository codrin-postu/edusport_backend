import * as React from 'react';
import {
  BirthDatePicker,
  BottomSheet,
  Button,
  EMPTY_DATE,
  Field,
  FieldRow,
  FilterPanel,
  PageHeader,
  RadioGroup,
  SearchableSelect,
  Section,
  Select,
  Window,
  adminToast,
  partsToDisplay,
  type ComboOption,
  type DateParts,
  type FilterSection,
} from '../../ui';

/** Phase 3 shared pieces on the UI reference page (plan 3-1). Synthetic data only. */

const GROUPS = ['Primii Pași', 'Începători', 'Intermediari Bronze', 'Intermediari Silver', 'Avansați Bronze', 'Avansați Silver', 'Avansați Gold'];
const GROUP_OPTIONS = GROUPS.map((g) => ({ value: g, label: g }));
const SEASONS = [
  { value: '2026-2027', label: '2026-2027' },
  { value: '2025-2026', label: '2025-2026' },
];
const GROUPED: ComboOption[] = [
  ...GROUPS.map((g) => ({ value: `s-${g}`, label: g, group: 'Școala de patinaj' })),
  { value: 'c-pro', label: 'Profesioniști', group: 'Club' },
  { value: 'c-av', label: 'Avansați', group: 'Club' },
];

function SelectDemo() {
  const [group, setGroup] = React.useState(GROUPS[0]);
  const [season, setSeason] = React.useState('');
  const [picked, setPicked] = React.useState<string | null>(null);
  return (
    <Section title="Select, SearchableSelect pe secțiuni">
      <FieldRow>
        <Field label="Grupa (Select)">
          <Select value={group} options={GROUP_OPTIONS} onChange={setGroup} />
        </Field>
        <Field label="Sezon">
          <Select value={season} placeholder="Toate sezoanele" options={SEASONS} onChange={setSeason} />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Dezactivat">
          <Select value="2026-2027" options={SEASONS} disabled />
        </Field>
        <Field label="Grupa (SearchableSelect)">
          <SearchableSelect value={picked} onChange={(v) => setPicked(v)} options={GROUPED} placeholder="Fără grupă deocamdată" />
        </Field>
      </FieldRow>
      <p className="ui-muted" data-testid="sel-out">
        Ales: {group}
      </p>
    </Section>
  );
}

function RadioDemo() {
  const [plain, setPlain] = React.useState<'da' | 'nu'>('da');
  const [choice, setChoice] = React.useState<'existent' | 'nou' | null>(null);
  return (
    <Section title="Radio">
      <RadioGroup
        aria-label="Dorește să fie membru"
        value={plain}
        onChange={setPlain}
        options={[
          { value: 'da', label: 'Da' },
          { value: 'nu', label: 'Nu' },
        ]}
      />
      <RadioGroup
        aria-label="Sportiv"
        variant="card"
        value={choice}
        onChange={setChoice}
        options={[
          { value: 'existent', label: 'Sportiv existent', hint: 'Înscrierea se adaugă la această fișă' },
          { value: 'nou', label: 'Sportiv nou', hint: 'Se creează o fișă nouă: Ana Pop' },
        ]}
      />
    </Section>
  );
}

function ToastDemo() {
  const undoable = () =>
    adminToast.success('Înscriere confirmată: Ana Pop', {
      duration: 8000,
      action: { label: 'Anulează', onClick: () => adminToast.info('Confirmare anulată') },
    });
  return (
    <Section title="Toast cu acțiune">
      <div className="ui-ref-row">
        <Button variant="secondary" onClick={undoable}>
          Toast cu acțiune
        </Button>
      </div>
    </Section>
  );
}

function SheetDemo({ label, desktop, fullHeight = false }: { label: string; desktop: 'dropdown' | 'modal'; fullHeight?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [group, setGroup] = React.useState(GROUPS[1]);
  const ref = React.useRef<HTMLButtonElement | null>(null);
  const footer = (
    <>
      <Button variant="secondary" onClick={() => setOpen(false)}>
        Anulează
      </Button>
      <Button onClick={() => setOpen(false)}>Gata</Button>
    </>
  );
  return (
    <>
      <Button ref={ref} variant="secondary" onClick={() => setOpen(!open)}>
        {label}
      </Button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={label} desktop={desktop} fullHeight={fullHeight} anchorRef={ref} dropdownWidth={360} footer={footer}>
        <Field label="Grupa">
          <Select value={group} options={GROUP_OPTIONS} onChange={setGroup} />
        </Field>
      </BottomSheet>
    </>
  );
}

interface DemoAthlete {
  section: string;
  group: string;
  acs: string;
  pub: string;
}

const SECTIONS = ['Școala de patinaj', 'Club'];
const ACS = ['Da', 'Nu', 'În așteptare'];
const DEMO: DemoAthlete[] = Array.from({ length: 18 }, (_, i) => ({
  section: SECTIONS[i % 5 === 0 ? 1 : 0],
  group: GROUPS[i % GROUPS.length],
  acs: ACS[i % 3],
  pub: i % 4 === 0 ? 'Public' : 'Ascuns',
}));
const opts = (list: string[]) => list.map((v) => ({ value: v, label: v }));

function FilterDemo() {
  const [picks, setPicks] = React.useState<Record<string, string[]>>({});
  const sections: FilterSection[] = [
    { key: 'section', label: 'Secțiune', options: opts(SECTIONS), selected: picks.section ?? [] },
    { key: 'group', label: 'Grupa', options: opts([...GROUPS, 'Profesioniști', 'Avansați']), selected: picks.group ?? [] },
    { key: 'acs', label: 'Membru A.C.S.', options: opts(ACS), selected: picks.acs ?? [] },
    { key: 'pub', label: 'Profil public', options: opts(['Public', 'Ascuns']), selected: picks.pub ?? [], single: true },
  ];
  const n = DEMO.filter((a) => sections.every((s) => s.selected.length === 0 || s.selected.includes(a[s.key as keyof DemoAthlete]))).length;
  return (
    <Section title="Filtre">
      <FilterPanel
        sections={sections}
        onChange={(key, selected) => setPicks((p) => ({ ...p, [key]: selected }))}
        onClearAll={() => setPicks({})}
        totalLabel={n === 1 ? '1 sportiv' : `${n} sportivi`}
        showLabel={n === 1 ? 'Arată 1 sportiv' : `Arată ${n} sportivi`}
      />
    </Section>
  );
}

function BirthDemo() {
  const [date, setDate] = React.useState<DateParts>(EMPTY_DATE);
  const [old, setOld] = React.useState<DateParts>({ day: 14, month: 3, year: 1998 });
  return (
    <Section title="Data nașterii">
      <FieldRow>
        <Field label="Data nașterii">
          <BirthDatePicker value={date} onChange={setDate} />
        </Field>
        <Field label="Data nașterii (în afara intervalului)">
          <BirthDatePicker value={old} onChange={setOld} />
        </Field>
      </FieldRow>
      <p className="ui-muted" data-testid="bd-out">
        {partsToDisplay(date) ?? ''}
      </p>
    </Section>
  );
}

export function Phase3Demos() {
  return (
    <Window>
      <PageHeader title="Componente faza 3" subtitle="Select, Radio, Toast cu acțiune, BottomSheet, Filtre, data nașterii." />
      <div className="ui-body">
        <SelectDemo />
        <RadioDemo />
        <ToastDemo />
        <Section title="BottomSheet">
          <div className="ui-ref-row">
            <SheetDemo label="Panou: meniu" desktop="dropdown" />
            <SheetDemo label="Panou: fereastră" desktop="modal" />
            <SheetDemo label="Panou: ecran întreg" desktop="modal" fullHeight />
          </div>
        </Section>
        <FilterDemo />
        <BirthDemo />
      </div>
    </Window>
  );
}
