import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import {
  AdminPage,
  Window,
  PageHeader,
  TwoColumn,
  Section,
  Field,
  Textarea,
  Button,
  StatusBadge,
  Notice,
  Loading,
  SaveBar,
  UnsavedGuard,
  useSaveState,
  ImagePicker,
} from '../ui';
import { DASHBOARD_TO } from './menu';

/**
 * EduSport admin, "Meniu site" page.
 *
 * The menu STRUCTURE stays in the frontend code
 * (edusport_frontend/src/components/blocks/header/navItems.ts). Nothing here
 * renames a section, changes an address, reorders anything, or adds or removes
 * a link. The left column is a read-only picture of the live menu, so the
 * editor can see where a card actually appears; only two fields on the right
 * are editable, and only for the sections that have a promo card.
 *
 * MENU below is a mirror of navItems.ts, kept for display only. If a label or
 * an address changes there, update it here too. The `key` values are the
 * contract between the two files: they match the rows stored on the
 * `navigation` single type. A key that exists here but not in the CMS simply
 * has no card.
 *
 * Data:
 *   GET /api/meniu-site  -> { data: { overrides: [{ key, description, image }] } }
 *   PUT /api/meniu-site     body { key, description, image: <fileId|null> }
 * Both are admin-guarded (global::is-admin). The single type is hidden from the
 * content-manager, so this page is the only way in.
 *
 * Images go through the standard upload plugin: POST /upload for a new file,
 * GET /upload/files to pick one already in the media library (shared
 * ImagePicker).
 *
 * Built on the shared admin UI (src/admin/ui): SaveBar + useSaveState for the
 * dirty / saving / saved flow, UnsavedGuard against leaving with edits.
 */

interface SubLink {
  label: string;
  href: string;
}

interface MenuSection {
  key: string;
  label: string;
  href?: string;
  /** true when the site renders a promo card for this section */
  promo?: boolean;
  dropdown?: SubLink[];
}

const MENU: MenuSection[] = [
  { key: 'acasa', label: 'Acasa', href: '/' },
  {
    key: 'despre-noi',
    label: 'Despre Noi',
    promo: true,
    dropdown: [
      { label: 'Istoric', href: '/despre-noi' },
      { label: 'Echipa', href: '/despre-noi/echipa' },
      { label: 'Sportivi', href: '/despre-noi/sportivi' },
      { label: 'Realizari', href: '/despre-noi/realizari' },
      { label: 'Voluntariat', href: '/voluntariat' },
    ],
  },
  {
    key: 'cursuri',
    label: 'Cursuri',
    promo: true,
    dropdown: [
      { label: 'Scoala de Patinaj - AFI Cotroceni', href: '/cursuri' },
      { label: 'Program Cursuri', href: '/cursuri/program' },
      { label: 'Evenimente si Competitii', href: '/cursuri/evenimente' },
      { label: 'Regulament Cursuri', href: '/cursuri/regulament' },
    ],
  },
  { key: 'noutati', label: 'Noutati', href: '/noutati' },
  { key: 'parteneri', label: 'Parteneri', href: '/parteneri' },
  { key: 'contact', label: 'Contact', href: '/contact' },
];

interface MediaRef {
  id: number;
  url: string;
  name: string | null;
}

interface Override {
  key: string;
  description: string | null;
  image: MediaRef | null;
}

// Page-local styles, tokens only (var(--adm-*)). Kept free of backticks on
// purpose: one stray backtick in a template literal takes the whole admin
// panel down to a blank page.
const NAV_CSS = `
.adm-root .meniu-tree{padding:12px 10px}
.adm-root .meniu-th{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--adm-text-muted);padding:4px 8px 10px}
.adm-root .meniu-row{display:flex;align-items:center;gap:9px;width:100%;text-align:left;font-family:inherit;font-size:13px;color:var(--adm-text-primary);background:none;border:none;border-radius:var(--adm-radius-sm);padding:8px 10px;cursor:pointer}
.adm-root .meniu-row:hover{background:var(--adm-accent-soft)}
.adm-root .meniu-row[aria-current="true"]{background:var(--adm-accent-soft);color:var(--adm-accent);font-weight:700}
.adm-root .meniu-row .meniu-addr{margin-left:auto;font-size:11px;color:var(--adm-text-muted);font-weight:400;font-variant-numeric:tabular-nums}
.adm-root .meniu-row[aria-current="true"] .meniu-addr{color:var(--adm-accent)}
.adm-root .meniu-row .adm-badge{margin-left:auto}
.adm-root .meniu-subs{margin:2px 0 8px 22px;border-left:1px solid var(--adm-line);padding-left:10px}
.adm-root .meniu-sub{display:flex;align-items:baseline;gap:10px;padding:5px 8px;font-size:12.5px;color:var(--adm-text-muted)}
.adm-root .meniu-sub .meniu-addr{margin-left:auto;font-size:11px;color:var(--adm-text-muted)}
.adm-root .meniu-note{padding:10px 8px 0}
.adm-root .meniu-img{display:flex;gap:13px;align-items:flex-start;flex-wrap:wrap}
.adm-root .meniu-pv{width:148px;height:92px;flex:none;border:1px solid var(--adm-line-strong);border-radius:var(--adm-radius-sm);background:var(--adm-surface-sunken) center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:var(--adm-text-muted);font-size:11.5px;text-align:center;padding:6px}
.adm-root .meniu-acts{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px}
`;

function toMap(rows: Override[]): Record<string, Override> {
  const map: Record<string, Override> = {};
  for (const row of rows) if (row?.key) map[row.key] = row;
  return map;
}

// ---- page ------------------------------------------------------------------
const NavigationPage: React.FC = () => {
  const { get, put } = useFetchClient();
  const save = useSaveState();

  const [overrides, setOverrides] = React.useState<Record<string, Override>>({});
  const [selected, setSelected] = React.useState<string>('despre-noi');
  const [description, setDescription] = React.useState('');
  const [image, setImage] = React.useState<MediaRef | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const section = MENU.find((s) => s.key === selected) ?? MENU[0];
  const stored = overrides[selected] ?? null;
  const editable = Boolean(section?.promo) && stored !== null;
  const { setDirty, reset, markDirty } = save;

  // Load the saved cards once.
  React.useEffect(() => {
    let off = false;
    (async () => {
      try {
        const r: any = await get('/api/meniu-site');
        if (off) return;
        setOverrides(toMap(r?.data?.data?.overrides ?? []));
      } catch {
        if (!off) setError(true);
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => {
      off = true;
    };
  }, [get]);

  // Fill the editor whenever the selection or the loaded data changes. Only
  // the dirty flag is cleared here, so the "Salvat" flash survives the
  // overrides refresh that follows a save.
  React.useEffect(() => {
    const row = overrides[selected] ?? null;
    setDescription(row?.description ?? '');
    setImage(row?.image ?? null);
    setDirty(false);
  }, [selected, overrides, setDirty]);

  const choose = (key: string) => {
    setSelected(key);
    reset();
  };

  const discard = () => {
    setDescription(stored?.description ?? '');
    setImage(stored?.image ?? null);
    reset();
  };

  const onSave = () => {
    if (!editable) return;
    void save.run(async () => {
      const r: any = await put('/api/meniu-site', {
        key: selected,
        description: description.trim() === '' ? null : description,
        image: image ? image.id : null,
      });
      setOverrides(toMap(r?.data?.data?.overrides ?? []));
    }, 'Nu am putut salva. Încearcă din nou.');
  };

  const rail = (
    <>
      <div className="meniu-th">Secțiuni</div>
      {MENU.map((s) => (
        <React.Fragment key={s.key}>
          <button
            type="button"
            className="meniu-row"
            aria-current={s.key === selected ? 'true' : undefined}
            onClick={() => choose(s.key)}
          >
            {s.label}
            {s.promo ? (
              <StatusBadge tone="accent">card</StatusBadge>
            ) : s.href ? (
              <span className="meniu-addr">{s.href}</span>
            ) : null}
          </button>
          {s.dropdown && (
            <div className="meniu-subs">
              {s.dropdown.map((d) => (
                <div className="meniu-sub" key={d.href}>
                  <span>{d.label}</span>
                  <span className="meniu-addr">{d.href}</span>
                </div>
              ))}
            </div>
          )}
        </React.Fragment>
      ))}
      <div className="adm-hint meniu-note">
        Numele, adresele și ordinea sunt stabilite în codul site-ului și nu se pot schimba de aici.
      </div>
    </>
  );

  return (
    <AdminPage>
      <style>{NAV_CSS}</style>
      <Window>
        <PageHeader
          back={{ to: DASHBOARD_TO }}
          title="Meniu site"
          subtitle="Descrierea și imaginea cardurilor din meniul de sus"
        />

        {loading ? (
          <Loading />
        ) : error ? (
          <div className="adm-body">
            <Notice tone="danger">Nu am putut încărca meniul.</Notice>
          </div>
        ) : (
          <TwoColumn rail={rail} railLabel="Secțiunile meniului" railClassName="meniu-tree">
            {!editable ? (
              <Section title={section?.label}>
                <p className="adm-muted" style={{ margin: 0 }}>
                  {section?.promo
                    ? 'Secțiunea are un card promo, dar el nu este încă înregistrat în administrare. Cere unui dezvoltator să îl adauge.'
                    : 'Secțiunea nu are card promo, deci nu are nimic de editat. Cardul apare doar la Despre Noi și Cursuri.'}
                </p>
              </Section>
            ) : (
              <Section title={`Card promo: ${section?.label}`}>
                <Field label="Descriere" hint="Apare în lista care se deschide pe desktop, sub titlul cardului.">
                  <Textarea
                    rows={3}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      markDirty();
                    }}
                    placeholder="Textul care apare sub titlul cardului."
                  />
                </Field>

                <div className="adm-field">
                  <span className="adm-label" id="meniu-img-label">
                    Imagine
                  </span>
                  <div className="meniu-img" role="group" aria-labelledby="meniu-img-label">
                    <div
                      className="meniu-pv"
                      style={image ? { backgroundImage: `url(${image.url})` } : undefined}
                    >
                      {!image && 'fără imagine'}
                    </div>
                    <div>
                      <div className="meniu-acts">
                        <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
                          {image ? 'Schimbă' : 'Alege'}
                        </Button>
                        {image && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setImage(null);
                              markDirty();
                            }}
                          >
                            Elimină
                          </Button>
                        )}
                      </div>
                      <div className="adm-hint">Recomandat 640 pe 400 px, sub 300 KB.</div>
                      {image?.name && <div className="adm-hint">{image.name}</div>}
                      {!image && (
                        <div className="adm-hint">
                          Fără imagine, cardul se afișează doar cu titlu și descriere.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Section>
            )}
          </TwoColumn>
        )}

        {!loading && !error && editable && <SaveBar {...save.bar} onSave={onSave} onDiscard={discard} />}
      </Window>

      <UnsavedGuard when={save.dirty} />

      <ImagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(f) => {
          setImage({ id: f.id, url: f.url, name: f.name });
          markDirty();
          setPickerOpen(false);
        }}
      />
    </AdminPage>
  );
};

export default NavigationPage;
