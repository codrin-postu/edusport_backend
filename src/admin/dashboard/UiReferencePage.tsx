import * as React from 'react';
import {
  AdminPage,
  Window,
  PageHeader,
  Section,
  TwoColumn,
  Button,
  StatusBadge,
  Chip,
  ChipList,
  Switch,
  Checkbox,
  Field,
  FieldRow,
  Input,
  Textarea,
  Select,
  DateInput,
  SaveBar,
  useSaveState,
  UnsavedGuard,
  Notice,
  EmptyState,
  Spinner,
  Loading,
  Modal,
  Tabs,
  Pager,
  DataTable,
  ImagePicker,
  InboxLayout,
  adminToast,
  useAdminTheme,
  themeVars,
  light,
  radius,
  space,
  type as typeRoles,
  THEME_NAMES,
  type ThemeName,
  type DataColumn,
  type PickedImage,
  type TypeRole,
} from '../ui';
import { ConfirmDialog } from '../ConfirmDialog';
import { DASHBOARD_TO } from './menu';

/**
 * Living reference for the shared admin UI (src/admin/ui): every component in
 * every state, plus the token swatches. Hidden route /admin/plugins/edusport-ui
 * (registered with addRoute in menu.tsx, so it is in no sidebar). Used for
 * light and dark screenshots: the preview switch below re-themes the page
 * without touching the Strapi setting.
 */

const Plus = () => (
  <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const Trash = () => (
  <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2.5 4h9M5.5 4V2.5h3V4M4 4l.6 7.5h4.8L10 4" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);
const Inbox = () => (
  <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M4 16h6l2 3h4l2-3h6M4 16l3-10h14l3 10v7H4z" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

interface Row {
  id: number;
  name: string;
  club: string;
  year: number;
  status: 'activ' | 'pauză' | 'retras';
}

const ROWS: Row[] = [
  { id: 1, name: 'Ana Popescu', club: 'EduSport Reșița', year: 2014, status: 'activ' },
  { id: 2, name: 'Ioana Mureșan', club: 'EduSport Reșița', year: 2012, status: 'activ' },
  { id: 3, name: 'Maria Ștefănescu', club: 'CSM Timișoara', year: 2015, status: 'pauză' },
  { id: 4, name: 'Elena Țurcanu', club: 'EduSport Reșița', year: 2011, status: 'retras' },
  { id: 5, name: 'Sara Dumitrescu', club: 'EduSport Reșița', year: 2016, status: 'activ' },
  { id: 6, name: 'Daria Ionescu', club: 'CS Arad', year: 2013, status: 'activ' },
  { id: 7, name: 'Irina Vasilescu', club: 'EduSport Reșița', year: 2014, status: 'pauză' },
];

const STATUS_TONE = { activ: 'ok', pauză: 'warn', retras: 'neutral' } as const;

const COLUMNS: DataColumn<Row>[] = [
  { key: 'name', header: 'Nume', sortable: true, render: (r) => <b>{r.name}</b> },
  { key: 'club', header: 'Club', sortable: true },
  { key: 'year', header: 'An naștere', sortable: true, align: 'right', render: (r) => <span className="adm-num">{r.year}</span> },
  {
    key: 'status',
    header: 'Stare',
    sortable: true,
    render: (r) => <StatusBadge tone={STATUS_TONE[r.status]}>{r.status}</StatusBadge>,
  },
];

interface Msg {
  id: string;
  from: string;
  text: string;
  when: string;
  unread: boolean;
}

const MSGS: Msg[] = [
  { id: 'a', from: 'Andrei Pop', text: 'Bună ziua, aș dori informații despre grupa de începători.', when: 'azi, 10:24', unread: true },
  { id: 'b', from: 'Cristina Mihai', text: 'Mulțumim pentru programul de vară, fetița s-a distrat.', when: 'ieri, 18:02', unread: false },
  { id: 'c', from: 'Radu Enache', text: 'Se poate plăti abonamentul prin transfer bancar?', when: 'luni, 09:15', unread: false },
];

function Swatches() {
  const vars = Object.keys(themeVars(light)).filter((k) => !k.startsWith('--adm-shadow') && k !== '--adm-color-scheme');
  return (
    <div className="adm-ref-row">
      {vars.map((v) => (
        <div className="adm-ref-swatch" key={v}>
          <i style={{ background: `var(${v})` }} />
          <span className="adm-ref-code">{v.replace('--adm-', '')}</span>
        </div>
      ))}
    </div>
  );
}

function Scales() {
  return (
    <div className="adm-stack" style={{ gap: 12 }}>
      <div className="adm-ref-row">
        {Object.keys(radius).map((k) => (
          <div className="adm-ref-swatch" key={k}>
            <i style={{ borderRadius: `var(--adm-radius-${k})`, background: 'var(--adm-accent-soft)', borderColor: 'var(--adm-accent)' }} />
            <span className="adm-ref-code">radius-{k}</span>
          </div>
        ))}
        {(['sm', 'md'] as const).map((k) => (
          <div className="adm-ref-swatch" key={k}>
            <i style={{ boxShadow: `var(--adm-shadow-${k})`, background: 'var(--adm-surface-raised)' }} />
            <span className="adm-ref-code">shadow-{k}</span>
          </div>
        ))}
      </div>
      <div className="adm-ref-row" style={{ alignItems: 'flex-end' }}>
        {Object.keys(space).map((k) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'block', width: `var(--adm-space-${k})`, height: `var(--adm-space-${k})`, background: 'var(--adm-accent)' }} />
            <span className="adm-ref-code">{k}</span>
          </div>
        ))}
      </div>
      {(Object.entries(typeRoles) as [string, TypeRole][]).map(([k, r]) => (
        <div key={k} style={{ fontSize: r.size, fontWeight: r.weight, lineHeight: r.lineHeight, textTransform: r.transform, letterSpacing: r.tracking }}>
          {k} {r.size}/{r.weight}: Înscrieri și competiții
        </div>
      ))}
    </div>
  );
}

function SaveBarDemo() {
  const save = useSaveState();
  const [name, setName] = React.useState('Cupa EduSport');
  const [saved, setSavedValue] = React.useState('Cupa EduSport');
  const [fail, setFail] = React.useState(false);
  const [guard, setGuard] = React.useState(false);
  const onSave = () =>
    save.run(
      () =>
        new Promise<void>((resolve, reject) =>
          window.setTimeout(() => {
            if (fail) reject(new Error('Serverul nu a răspuns. Încearcă din nou.'));
            else {
              setSavedValue(name);
              resolve();
            }
          }, 900),
        ),
    );
  return (
    <div className="adm-win">
      <div className="adm-body">
        <Field label="Nume competiție" hint="Modifică textul ca să vezi bara activă. Cmd/Ctrl+S salvează.">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              save.markDirty();
            }}
          />
        </Field>
        <div className="adm-ref-row">
          <Switch checked={fail} onChange={setFail} label="Simulează o eroare la salvare" />
          <Switch checked={guard} onChange={setGuard} label="Protecție la ieșire" description="Cere confirmare dacă pleci cu modificări nesalvate" />
        </div>
      </div>
      <SaveBar
        {...save.bar}
        onSave={onSave}
        onDiscard={() => {
          setName(saved);
          save.reset();
        }}
      />
      {guard && <UnsavedGuard when={save.dirty} />}
    </div>
  );
}

function StaticSaveBars() {
  const noop = () => {};
  return (
    <div className="adm-stack" style={{ gap: 8 }}>
      <div className="adm-win"><SaveBar dirty={false} saving={false} onSave={noop} onDiscard={noop} shortcut={false} /></div>
      <div className="adm-win"><SaveBar dirty saving={false} onSave={noop} onDiscard={noop} shortcut={false} /></div>
      <div className="adm-win"><SaveBar dirty saving onSave={noop} onDiscard={noop} shortcut={false} /></div>
      <div className="adm-win"><SaveBar dirty={false} saving={false} saved onSave={noop} onDiscard={noop} shortcut={false} /></div>
      <div className="adm-win"><SaveBar dirty saving={false} error="Nu am putut salva. Încearcă din nou." onSave={noop} onDiscard={noop} shortcut={false} /></div>
    </div>
  );
}

function Controls() {
  const [sw, setSw] = React.useState(true);
  const [sw2, setSw2] = React.useState(false);
  const [cb, setCb] = React.useState(true);
  const [cb2, setCb2] = React.useState(false);
  const [chips, setChips] = React.useState(['Național', 'Juniori', 'Program Scurt']);
  return (
    <>
      <Section title="Switch (setări pornit / oprit)">
        <div className="adm-ref-row" style={{ gap: 24 }}>
          <Switch checked={sw} onChange={setSw} label="Vizibil pe site" />
          <Switch checked={sw2} onChange={setSw2} label="Afișează în meniu" description="Apare în lista din bara de sus" />
          <Switch checked onChange={() => {}} label="Pornit, dezactivat" disabled />
          <Switch checked={false} onChange={() => {}} label="Oprit, dezactivat" disabled />
          <Switch checked={sw} onChange={setSw} aria-label="Fără etichetă vizibilă" />
        </div>
      </Section>
      <Section title="Checkbox (alegere de opțiuni)">
        <div className="adm-ref-row" style={{ gap: 24 }}>
          <Checkbox checked={cb} onChange={setCb} label="Program Scurt" />
          <Checkbox checked={cb2} onChange={setCb2} label="Program Liber" />
          <Checkbox checked={false} onChange={() => {}} indeterminate label="Parțial" />
          <Checkbox checked onChange={() => {}} disabled label="Bifat, dezactivat" />
          <Checkbox checked={false} onChange={() => {}} disabled label="Dezactivat" />
        </div>
      </Section>
      <Section title="Chip">
        <ChipList>
          {chips.map((c) => (
            <Chip key={c} onRemove={() => setChips((cur) => cur.filter((x) => x !== c))}>
              {c}
            </Chip>
          ))}
          <Chip>Fără buton de eliminare</Chip>
        </ChipList>
        {chips.length < 3 && (
          <div>
            <Button variant="secondary" size="sm" onClick={() => setChips(['Național', 'Juniori', 'Program Scurt'])}>
              Refă lista
            </Button>
          </div>
        )}
      </Section>
    </>
  );
}

function Fields() {
  const [date, setDate] = React.useState<string | null>('2026-10-12');
  const [dt, setDt] = React.useState<string | null>(null);
  const [lvl, setLvl] = React.useState('national');
  return (
    <Section title="Câmpuri">
      <FieldRow>
        <Field label="Nume" required hint="Cum apare pe site.">
          <Input placeholder="ex. Ana Popescu" />
        </Field>
        <Field label="Email" required error="Adresa de email nu este validă.">
          <Input type="email" defaultValue="ana@" />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Nivel">
          <Select
            value={lvl}
            onChange={setLvl}
            options={[
              { value: 'national', label: 'Național' },
              { value: 'international', label: 'Internațional' },
            ]}
          />
        </Field>
        <Field label="Categorie" hint="Cu opțiune goală.">
          <Select value="" onChange={() => {}} placeholder="Alege o categorie" options={[{ value: 'j', label: 'Juniori' }]} />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Data competiției">
          <DateInput value={date} onChange={setDate} />
        </Field>
        <Field label="Data și ora" hint="Gol = null.">
          <DateInput value={dt} onChange={setDt} withTime />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Descriere" hint="Maxim 300 de caractere.">
          <Textarea placeholder="Textul care apare sub titlu." />
        </Field>
        <Field label="Dezactivat">
          <Input value="Calculat automat" disabled readOnly />
        </Field>
      </FieldRow>
    </Section>
  );
}

function Dialogs() {
  const [modal, setModal] = React.useState(false);
  const [confirm, setConfirm] = React.useState<null | 'simple' | 'typed' | 'busy'>(null);
  const [picker, setPicker] = React.useState<null | 'single' | 'multiple'>(null);
  const [picked, setPicked] = React.useState<PickedImage[]>([]);
  return (
    <Section title="Modal, ConfirmDialog, ImagePicker">
      <div className="adm-ref-row">
        <Button variant="secondary" onClick={() => setModal(true)}>Deschide Modal</Button>
        <Button variant="danger" onClick={() => setConfirm('simple')}>ConfirmDialog</Button>
        <Button variant="danger" onClick={() => setConfirm('typed')}>Cu text de confirmare</Button>
        <Button variant="danger" onClick={() => setConfirm('busy')}>În curs (busy + eroare)</Button>
        <Button variant="secondary" onClick={() => setPicker('single')}>Alege o imagine</Button>
        <Button variant="secondary" onClick={() => setPicker('multiple')}>Alege mai multe imagini</Button>
      </div>
      {picked.length > 0 && (
        <ChipList>
          {picked.map((p) => (
            <Chip key={p.id} onRemove={() => setPicked((cur) => cur.filter((x) => x.id !== p.id))}>
              {p.name ?? `#${p.id}`}
            </Chip>
          ))}
        </ChipList>
      )}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Titlu fereastră"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Anulează</Button>
            <Button variant="primary" onClick={() => setModal(false)}>
              Confirmă
            </Button>
          </>
        }
      >
        <p style={{ marginTop: 0 }}>Escape sau un clic pe fundal închide fereastra. Tab rămâne în interior.</p>
        <Field label="Câmp în fereastră">
          <Input placeholder="Focus prins în fereastră" />
        </Field>
      </Modal>
      <ConfirmDialog
        open={confirm !== null}
        title="Ștergi sportivul?"
        message="Sportivul și toate rezultatele lui dispar de pe site."
        detail="Acțiunea nu poate fi anulată."
        requireTypedText={confirm === 'typed' ? 'Ana Popescu' : undefined}
        busy={confirm === 'busy'}
        error={confirm === 'busy' ? 'Nu am putut șterge. Încearcă din nou.' : null}
        onConfirm={() => setConfirm(null)}
        onCancel={() => setConfirm(null)}
      />
      {confirm === 'busy' && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 500 }}>
          <Button variant="primary" onClick={() => setConfirm(null)}>
            Închide demo busy
          </Button>
        </div>
      )}
      <ImagePicker
        open={picker === 'single'}
        onClose={() => setPicker(null)}
        onPick={(img) => {
          setPicked([img]);
          setPicker(null);
        }}
      />
      <ImagePicker
        open={picker === 'multiple'}
        multiple
        onClose={() => setPicker(null)}
        onPick={(imgs) => {
          setPicked(imgs);
          setPicker(null);
        }}
      />
    </Section>
  );
}

function InboxDemo() {
  const [tab, setTab] = React.useState('all');
  const [sel, setSel] = React.useState<string | null>('a');
  const [page, setPage] = React.useState(1);
  const items = tab === 'new' ? MSGS.filter((m) => m.unread) : MSGS;
  const current = MSGS.find((m) => m.id === sel) ?? null;
  return (
    <div className="adm-win">
      <InboxLayout<Msg>
        tabs={[
          { id: 'all', label: 'Toate' },
          { id: 'new', label: 'Noi', count: MSGS.filter((m) => m.unread).length },
          { id: 'done', label: 'Rezolvate' },
        ]}
        activeTab={tab}
        onTabChange={setTab}
        toolbar={<Input type="search" placeholder="Caută după nume sau email" aria-label="Caută" style={{ maxWidth: 320 }} />}
        items={tab === 'done' ? [] : items}
        getKey={(m) => m.id}
        groupBy={(list) => [{ label: 'Săptămâna aceasta', items: list }]}
        renderItem={(m) => (
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <b style={{ fontWeight: m.unread ? 800 : 600 }}>{m.from}</b>
              <span className="adm-muted" style={{ marginLeft: 'auto', fontSize: 11 }}>
                {m.when}
              </span>
            </div>
            <div className="adm-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.text}
            </div>
          </div>
        )}
        selectedKey={sel}
        onSelect={setSel}
        empty="Niciun mesaj pentru filtrul curent."
        page={page}
        pageCount={3}
        total={62}
        pageSize={25}
        onPageChange={setPage}
        readerEmpty="Selectează un mesaj din listă pentru a-l citi."
        reader={
          current && (
            <div className="adm-stack" style={{ gap: 10 }}>
              <h3 style={{ margin: 0 }}>{current.from}</h3>
              <span className="adm-muted">Trimis {current.when}</span>
              <p style={{ margin: 0 }}>{current.text}</p>
            </div>
          )
        }
      />
    </div>
  );
}

const UiReferencePage: React.FC = () => {
  const theme = useAdminTheme();
  const [preview, setPreview] = React.useState<ThemeName | 'auto'>('auto');
  const [tab, setTab] = React.useState('one');
  const [page, setPage] = React.useState(4);
  const [loadingTable, setLoadingTable] = React.useState(false);

  return (
    <div data-adm-theme={preview === 'auto' ? undefined : preview}>
      <AdminPage>
        <Window>
          <PageHeader
            back={{ to: DASHBOARD_TO, label: 'Panou' }}
            title="Componente admin"
            subtitle={`Referință pentru src/admin/ui. Tema Strapi: ${theme}.`}
            actions={
              <>
                <Select
                  aria-label="Previzualizează tema"
                  value={preview}
                  onChange={(v) => setPreview(v as ThemeName | 'auto')}
                  options={[{ value: 'auto', label: 'Tema Strapi' }, ...THEME_NAMES.map((n) => ({ value: n, label: `Tema ${n}` }))]}
                  style={{ width: 'auto' }}
                />
                <Button variant="primary" icon={<Plus />}>
                  Adaugă
                </Button>
              </>
            }
          />
          <TwoColumn
            railLabel="Coloană laterală"
            rail={
              <div className="adm-stack" style={{ gap: 10 }}>
                <span className="adm-label">Coloană laterală</span>
                <span className="adm-muted">TwoColumn: 280px, se așază una sub alta sub 900px.</span>
                <StatusBadge tone="accent" size="md">
                  Auto
                </StatusBadge>
              </div>
            }
          >
            <Section title="Culori (tokens)" aside={<span className="adm-muted">--adm-*</span>}>
              <Swatches />
            </Section>
            <Section title="Colțuri, umbre, spațiere, text">
              <Scales />
            </Section>
            <Section title="Butoane">
              {(['md', 'sm'] as const).map((size) => (
                <div className="adm-ref-row" key={size}>
                  <Button variant="primary" size={size}>Salvează</Button>
                  <Button variant="secondary" size={size}>Anulează</Button>
                  <Button variant="danger" size={size} icon={<Trash />}>Șterge</Button>
                  <Button variant="ghost" size={size}>Renunță</Button>
                  <Button variant="primary" size={size} loading>Se salvează</Button>
                  <Button variant="secondary" size={size} disabled>Dezactivat</Button>
                  <Button variant="secondary" size={size} iconOnly icon={<Plus />} aria-label="Adaugă" />
                  <Button variant="danger" size={size} iconOnly icon={<Trash />} aria-label="Șterge" />
                  <Button variant="ghost" size={size} iconOnly icon={<Plus />} aria-label="Adaugă rând" />
                </div>
              ))}
            </Section>
            <Section title="StatusBadge">
              {(['sm', 'md'] as const).map((size) => (
                <div className="adm-ref-row" key={size}>
                  <StatusBadge tone="ok" size={size}>Publicat</StatusBadge>
                  <StatusBadge tone="warn" size={size}>În așteptare</StatusBadge>
                  <StatusBadge tone="danger" size={size}>Respins</StatusBadge>
                  <StatusBadge tone="info" size={size}>Nou</StatusBadge>
                  <StatusBadge tone="neutral" size={size}>Ascuns</StatusBadge>
                  <StatusBadge tone="accent" size={size}>Auto</StatusBadge>
                  <StatusBadge custom={{ fg: 'var(--adm-text-on-accent)', bg: 'var(--adm-accent)' }} size={size}>
                    Din configurare
                  </StatusBadge>
                </div>
              ))}
            </Section>
            <Controls />
            <Fields />
            <Section title="Notice">
              <Notice tone="ok" title="Salvat">Modificările au fost salvate.</Notice>
              <Notice tone="info" title="Setarea este pe altă pagină" action={<Button variant="secondary" size="sm">Deschide Setări site</Button>}>
                Adresa de email se schimbă din Setări site.
              </Notice>
              <Notice tone="warn" title="Atenție">Imaginea are peste 300 KB și se încarcă greu pe telefon.</Notice>
              <Notice tone="danger">Nu am putut încărca meniul.</Notice>
            </Section>
            <Section title="EmptyState, Spinner">
              <EmptyState icon={<Inbox />} action={<Button variant="secondary" size="sm" icon={<Plus />}>Adaugă primul sportiv</Button>}>
                Nu există încă sportivi.
              </EmptyState>
              <EmptyState>Niciun rezultat pentru căutare.</EmptyState>
              <div className="adm-ref-row">
                <Spinner />
                <Spinner size={24} label="Se încarcă" />
              </div>
              <Loading />
            </Section>
            <Section title="Tabs, Pager">
              <Tabs
                label="Exemplu"
                value={tab}
                onChange={setTab}
                items={[
                  { id: 'one', label: 'Toate', count: 42 },
                  { id: 'two', label: 'Noi', count: 3 },
                  { id: 'three', label: 'Arhivate' },
                  { id: 'four', label: 'Dezactivat', disabled: true },
                ]}
              />
              <Pager page={page} pageCount={9} total={214} pageSize={25} onChange={setPage} />
            </Section>
            <Dialogs />
          </TwoColumn>
        </Window>

        <Window>
          <PageHeader
            title="DataTable"
            subtitle="Căutare, sortare pe coloane, paginare (5 pe pagină), clic pe rând."
            actions={
              <Switch checked={loadingTable} onChange={setLoadingTable} label="Se încarcă" />
            }
          />
          <DataTable<Row>
            columns={COLUMNS}
            rows={ROWS}
            getRowKey={(r) => r.id}
            onRowClick={() => {}}
            rowLabel={(r) => `Deschide ${r.name}`}
            search
            searchPlaceholder="Caută după nume sau club"
            pageSize={5}
            loading={loadingTable}
            initialSort={{ key: 'name', dir: 'asc' }}
            caption="Sportivi"
          />
        </Window>
        <Window>
          <PageHeader title="DataTable gol" />
          <DataTable<Row> columns={COLUMNS} rows={[]} getRowKey={(r) => r.id} empty="Nu există încă sportivi." />
        </Window>

        <Window>
          <PageHeader title="SaveBar" subtitle="useSaveState + SaveBar + UnsavedGuard, apoi toate stările." />
          <div className="adm-body">
            <SaveBarDemo />
            <StaticSaveBars />
          </div>
        </Window>

        <Window>
          <PageHeader
            title="Toast"
            subtitle="Mesaje generale, cu durată scurtă. Notice rămâne pentru mesaje persistente, legate de o pagină."
          />
          <div className="adm-body">
            <div className="adm-ref-row">
              <Button variant="secondary" onClick={() => adminToast.success('Modificările au fost salvate.')}>Success</Button>
              <Button variant="secondary" onClick={() => adminToast.info('Setarea este pe altă pagină.')}>Info</Button>
              <Button variant="secondary" onClick={() => adminToast.warn('Imaginea are peste 300 KB.')}>Warn</Button>
              <Button variant="secondary" onClick={() => adminToast.error('Nu am putut salva. Încearcă din nou.')}>Error</Button>
            </div>
          </div>
        </Window>

        <Window>
          <PageHeader title="InboxLayout" subtitle="Listă + cititor, cu file și paginare." />
          <InboxDemo />
        </Window>
      </AdminPage>
    </div>
  );
};

export default UiReferencePage;
