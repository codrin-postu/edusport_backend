import * as React from 'react';
import {
  AdminPage,
  Window,
  PageHeader,
  Notice,
  Loading,
  SaveBar,
  UnsavedGuard,
  EditorCard,
  Field,
  FieldRow,
  Input,
  Textarea,
  Button,
  RepeatableList,
  normalizeObject,
} from '../ui';
import { useSingleType, usePageForm } from '../lib';
import { DASHBOARD_TO } from '../dashboard/menu';
import { UID } from './routes';

/**
 * Prețuri (the Taxe & Prețuri section of /cursuri): the pricing single type.
 *
 * Replaces the content-manager view and its two custom fields,
 * component-preview PricingTiersEditor (`tiers`) and FooterNotesEditor
 * (`footerNotes`). Both are JSON attributes; the shapes stay exactly as those
 * editors wrote them, so the website reads them unchanged:
 *   tiers:       { memberTiers: Tier[], nonMemberTiers: Tier[], memberFeeLabel, memberFeePrice }
 *                Tier = { label, price, tooltip?, note? }
 *   footerNotes: string[]
 * Keys the editor did not know are kept (the objects are merged, not rebuilt).
 * The rows show on the site in list order, so they can be reordered here.
 */

interface Tier {
  label: string;
  price: string;
  tooltip?: string;
  note?: string;
}

interface Tiers {
  memberTiers: Tier[];
  nonMemberTiers: Tier[];
  memberFeeLabel?: string;
  memberFeePrice?: string;
}

interface Pricing {
  tiers: Tiers | null;
  footerNotes: string[] | null;
}

type Side = 'memberTiers' | 'nonMemberTiers';

const EMPTY_TIERS: Tiers = { memberTiers: [], nonMemberTiers: [], memberFeeLabel: '', memberFeePrice: '' };

const tierList = (v: unknown): Tier[] =>
  Array.isArray(v) ? v.filter((t): t is Tier => !!t && typeof t === 'object' && !Array.isArray(t)) : [];
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : String(x ?? ''))) : []);

/**
 * Stable React keys for a list whose items carry no id (strings, plain JSON
 * objects). A row keeps its key while it is edited (same index, new value),
 * moved (same value, new index) or when rows around it are added / removed,
 * so inputs keep focus and expanded state survives.
 */
function useRowKeys<T>(items: readonly T[]): (item: T, index: number) => number {
  const ref = React.useRef<{ items: readonly T[]; keys: number[]; next: number }>({ items: [], keys: [], next: 1 });
  const st = ref.current;
  if (st.items !== items) {
    const used = new Set<number>();
    const keys: Array<number | undefined> = items.map((it, i) => {
      if (i < st.items.length && Object.is(st.items[i], it)) {
        used.add(i);
        return st.keys[i];
      }
      return undefined;
    });
    items.forEach((it, i) => {
      if (keys[i] !== undefined) return;
      const j = st.items.findIndex((old, k) => !used.has(k) && Object.is(old, it));
      if (j >= 0) {
        used.add(j);
        keys[i] = st.keys[j];
      }
    });
    const leftover = st.keys.filter((_, k) => !used.has(k));
    st.keys = keys.map((k) => k ?? leftover.shift() ?? st.next++);
    st.items = items;
  }
  return (_item, index) => st.keys[index];
}

/** One column of tiers: label + price per row, tooltip / note behind "Adaugă tooltip / notă". */
function TierList({ tiers, onChange }: { tiers: Tier[]; onChange: (next: Tier[]) => void }) {
  const keyOf = useRowKeys(tiers);
  const [opened, setOpened] = React.useState<Set<number>>(() => new Set());
  const toggle = (key: number) =>
    setOpened((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  return (
    <RepeatableList<Tier>
      items={tiers}
      onChange={onChange}
      getKey={keyOf}
      newItem={() => ({ label: '', price: '' })}
      addLabel="Adaugă rând"
      emptyLabel="Niciun rând adăugat"
      reorder
      confirmDelete="Rândul dispare din listă după ce salvezi pagina."
      itemLabel={(t, i) => (t.label ? `rândul „${t.label}”` : `rândul ${i + 1}`)}
      renderRow={(tier, i, row) => {
        const key = keyOf(tier, i);
        const filled = Boolean(tier.tooltip || tier.note);
        const showExtra = filled || opened.has(key);
        return (
          <>
            <FieldRow>
              <Field label="Etichetă">
                <Input value={tier.label ?? ''} placeholder="Etichetă…" onChange={(e) => row.update({ label: e.target.value })} />
              </Field>
              <Field label="Preț">
                <Input value={tier.price ?? ''} placeholder="ex: 350 lei / lună" onChange={(e) => row.update({ price: e.target.value })} />
              </Field>
            </FieldRow>
            {showExtra && (
              <>
                <Field label="Tooltip" hint="Opțional">
                  <Textarea rows={1} value={tier.tooltip ?? ''} onChange={(e) => row.update({ tooltip: e.target.value })} />
                </Field>
                <Field label="Notă sub etichetă" hint="Opțional · text mic afișat sub numele prețului">
                  <Textarea rows={1} value={tier.note ?? ''} onChange={(e) => row.update({ note: e.target.value })} />
                </Field>
              </>
            )}
            <div>
              <Button
                variant="ghost"
                size="sm"
                disabled={showExtra && filled}
                aria-expanded={showExtra}
                onClick={() => toggle(key)}
              >
                {showExtra ? 'Ascunde detalii opționale' : 'Adaugă tooltip / notă'}
              </Button>
            </div>
          </>
        );
      }}
    />
  );
}

const PreturiPage: React.FC = () => {
  const page = useSingleType<Pricing>(UID.pricing);
  const form = usePageForm<Pricing>(page.data, page.saveState);

  const tiers = normalizeObject<Tiers>(form.value.tiers, EMPTY_TIERS);
  const member = React.useMemo(() => tierList(tiers.memberTiers), [tiers.memberTiers]);
  const nonMember = React.useMemo(() => tierList(tiers.nonMemberTiers), [tiers.nonMemberTiers]);
  const notes = React.useMemo(() => strings(form.value.footerNotes), [form.value.footerNotes]);
  const notesKey = useRowKeys(notes);

  const setTiers = (patch: Partial<Tiers>) => form.set('tiers', { ...tiers, ...patch });
  const setSide = (side: Side) => (next: Tier[]) => setTiers({ [side]: next });

  return (
    <AdminPage>
      <Window>
        <PageHeader
          back={{ to: DASHBOARD_TO }}
          title="Prețuri"
          subtitle="Tarifele pentru membri și non-membri și notițele din secțiunea Taxe & Prețuri"
        />

        {page.loading ? (
          <Loading />
        ) : page.error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca prețurile.</Notice>
          </div>
        ) : (
          <div className="ui-body">
            <div className="ui-grid2" style={{ alignItems: 'start', gap: 'var(--ui-space-4)' }}>
              <EditorCard title="Prețuri curs membri" description="Tarifele afișate pentru cursanții cu abonament.">
                <div className="ui-ofc">
                  <div className="ui-ofc-sec">
                    <h4 className="ui-ofc-sec-title">Tarife</h4>
                    <TierList tiers={member} onChange={setSide('memberTiers')} />
                  </div>
                  <div className="ui-ofc-sec">
                    <h4 className="ui-ofc-sec-title">Taxă membru</h4>
                    <FieldRow>
                      <Field label="Etichetă taxă">
                        <Input
                          value={tiers.memberFeeLabel ?? ''}
                          placeholder="Etichetă taxă…"
                          onChange={(e) => setTiers({ memberFeeLabel: e.target.value })}
                        />
                      </Field>
                      <Field label="Preț">
                        <Input
                          value={tiers.memberFeePrice ?? ''}
                          placeholder="ex: 100 lei"
                          onChange={(e) => setTiers({ memberFeePrice: e.target.value })}
                        />
                      </Field>
                    </FieldRow>
                  </div>
                </div>
              </EditorCard>

              <EditorCard title="Prețuri curs non-membri" description="Tarifele afișate pentru cursanții fără abonament.">
                <TierList tiers={nonMember} onChange={setSide('nonMemberTiers')} />
              </EditorCard>
            </div>

            <EditorCard
              title="Notițe subsol"
              description="Texte afișate în subsolul secțiunii de prețuri (Taxe & Prețuri). Folosite pentru clarificări despre taxa de membru, politica de prețuri etc."
            >
              <RepeatableList<string>
                items={notes}
                onChange={(next) => form.set('footerNotes', next)}
                getKey={notesKey}
                newItem={() => ''}
                addLabel="Adaugă notă"
                emptyLabel="Niciun element adăugat"
                aria-label="Notițe subsol"
                itemLabel={(_, i) => `nota ${i + 1}`}
                renderRow={(text, i, row) => (
                  <Textarea
                    aria-label={`Notițe subsol ${i + 1}`}
                    rows={2}
                    value={text}
                    placeholder="Textul notei…"
                    onChange={(e) => row.update(e.target.value)}
                  />
                )}
              />
            </EditorCard>
          </div>
        )}

        {!page.loading && !page.error && (
          <SaveBar {...page.saveState.bar} onSave={() => void page.save(form.value)} onDiscard={form.reset} />
        )}
      </Window>

      <UnsavedGuard when={form.dirty} />
    </AdminPage>
  );
};

export default PreturiPage;
