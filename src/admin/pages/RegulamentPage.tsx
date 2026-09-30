import * as React from 'react';
import {
  AdminPage,
  Window,
  PageHeader,
  Notice,
  Loading,
  SaveBar,
  UnsavedGuard,
  ObjectFieldCard,
  EditorCard,
  Field,
  FieldRow,
  Input,
  Textarea,
  Select,
  Checkbox,
  StatusBadge,
  RepeatableList,
  adminToast,
  normalizeObject,
} from '../ui';
import { useSingleType, usePageForm } from '../lib';
import { DASHBOARD_TO } from '../dashboard/menu';
import { UID } from './routes';

/**
 * Regulament (/cursuri/regulament on the site): the course-regulations single type.
 *
 * Replaces the content-manager view: the `banner` custom field
 * (component-preview CourseRegsBannerEditor, JSON { bannerTitle, bannerSubtitle })
 * and the native repeatable component `categories`
 * (regulations.regulation-category: title (required), icon (enum), rules),
 * whose `rules` is the RulesTable custom field (JSON Rule[] = { label, text, highlight }).
 * Shapes stay exactly as before, so the website reads them unchanged. The
 * category list is sent whole on save (components keep their `id`, so they
 * update in place; a removed category is deleted).
 */

interface Banner {
  bannerTitle: string;
  bannerSubtitle: string;
}

interface Rule {
  label: string;
  text: string;
  highlight: boolean;
}

const ICONS = ['Users', 'CalendarCheck', 'Layers', 'ShieldAlert', 'MessageCircle'] as const;
type IconName = (typeof ICONS)[number];

interface Category {
  id?: number;
  title: string;
  icon: IconName | null;
  rules: Rule[] | null;
}

interface CourseRegulations {
  banner: Banner | null;
  categories: Category[] | null;
}

const EMPTY_BANNER: Banner = { bannerTitle: '', bannerSubtitle: '' };
const ICON_OPTIONS = ICONS.map((v) => ({ value: v, label: v }));

const ruleList = (v: unknown): Rule[] =>
  Array.isArray(v) ? v.filter((r): r is Rule => !!r && typeof r === 'object' && !Array.isArray(r)) : [];

/**
 * Stable React keys for a list whose items carry no id (strings, plain JSON
 * objects, new components). A row keeps its key while it is edited (same
 * index, new value), moved (same value, new index) or when rows around it are
 * added / removed, so inputs keep focus and expanded state survives.
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

/** The rules of one category (the plugin's RulesTable): drag or keyboard to reorder, expand to edit. */
function RulesTable({ rules, onChange }: { rules: Rule[]; onChange: (next: Rule[]) => void }) {
  const keyOf = useRowKeys(rules);
  return (
    <div className="ui-field">
      <div className="ui-label">Reguli</div>
      <RepeatableList<Rule>
        items={rules}
        onChange={onChange}
        getKey={keyOf}
        newItem={() => ({ label: '', text: '', highlight: false })}
        addLabel="Adaugă regulă"
        emptyLabel="Nicio regulă adăugată"
        aria-label="Reguli"
        reorder
        expandable
        confirmDelete="Regula dispare din listă după ce salvezi pagina."
        itemLabel={(r, i) => (r.label ? `regula „${r.label}”` : `regula ${i + 1}`)}
        renderSummary={(r, i) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ui-space-2)' }}>
            <span className="ui-muted">{i + 1}.</span>
            <span className={r.label ? undefined : 'ui-muted'}>{r.label || 'Fără titlu'}</span>
            {r.highlight && <StatusBadge tone="warning">Evidențiată</StatusBadge>}
          </span>
        )}
        renderRow={(r, _i, row) => (
          <>
            <Field label="Etichetă scurtă">
              <Input value={r.label ?? ''} placeholder="Etichetă scurtă…" onChange={(e) => row.update({ label: e.target.value })} />
            </Field>
            <Field label="Text complet">
              <Textarea rows={3} value={r.text ?? ''} placeholder="Textul complet al regulii…" onChange={(e) => row.update({ text: e.target.value })} />
            </Field>
            <Checkbox checked={Boolean(r.highlight)} onChange={(v) => row.update({ highlight: v })} label="Evidențiază această regulă" />
          </>
        )}
      />
      <div className="ui-hint">Trage de mâner pentru a reordona. Fiecare rând are o etichetă, un text și o opțiune de evidențiere.</div>
    </div>
  );
}

const RegulamentPage: React.FC = () => {
  const page = useSingleType<CourseRegulations>(UID.courseRegulations);
  const form = usePageForm<CourseRegulations>(page.data, page.saveState);
  const [tried, setTried] = React.useState(false);

  const banner = normalizeObject<Banner>(form.value.banner, EMPTY_BANNER);
  const categories = React.useMemo<Category[]>(() => (Array.isArray(form.value.categories) ? form.value.categories : []), [form.value.categories]);
  const catKey = useRowKeys(categories);

  const setCategories = (next: Category[]) => form.set('categories', next);

  const save = () => {
    setTried(true);
    if (categories.some((c) => !String(c.title ?? '').trim())) {
      adminToast.error('Fiecare categorie are nevoie de un titlu.');
      return;
    }
    void page.save(form.value).then((ok) => {
      if (ok) setTried(false);
    });
  };

  const discard = () => {
    setTried(false);
    form.reset();
  };

  return (
    <AdminPage>
      <Window>
        <PageHeader
          back={{ to: DASHBOARD_TO }}
          title="Regulament"
          subtitle="Bannerul și regulile cursurilor, pe categorii, de pe pagina /cursuri/regulament"
        />

        {page.loading ? (
          <Loading />
        ) : page.error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca regulamentul.</Notice>
          </div>
        ) : (
          <div className="ui-body">
            <ObjectFieldCard<Banner>
              title="Regulament Cursuri - Banner"
              description="Titlul și subtitlul bannerului pentru pagina cu regulamentul cursurilor."
              value={banner}
              onFieldChange={(key, v) => form.set('banner', { ...banner, [key]: v })}
              fields={[
                { key: 'bannerTitle', label: 'Titlu banner', hint: 'ex: Regulamentul cursurilor', placeholder: 'ex: Regulamentul cursurilor', span: 2 },
                {
                  key: 'bannerSubtitle',
                  label: 'Subtitlu banner',
                  hint: 'Textul de sub titlul bannerului',
                  type: 'textarea',
                  rows: 3,
                  placeholder: 'Subtitlul bannerului...',
                },
              ]}
            />

            <EditorCard title="Categorii" description="Fiecare categorie este un grup de reguli sub un titlu. Ordinea de aici este ordinea de pe site.">
              <RepeatableList<Category>
                items={categories}
                onChange={setCategories}
                getKey={catKey}
                newItem={() => ({ title: '', icon: null, rules: [] })}
                addLabel="Adaugă categorie"
                emptyLabel="Nicio categorie adăugată"
                aria-label="Categorii"
                reorder
                expandable
                confirmDelete="Categoria și toate regulile ei dispar după ce salvezi pagina."
                itemLabel={(c, i) => (c.title ? `categoria „${c.title}”` : `categoria ${i + 1}`)}
                renderSummary={(c) => {
                  const n = ruleList(c.rules).length;
                  return (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ui-space-2)' }}>
                      <span className={c.title ? undefined : 'ui-muted'}>{c.title || 'Categorie nouă'}</span>
                      <span className="ui-muted">· {n === 1 ? '1 regulă' : `${n} reguli`}</span>
                    </span>
                  );
                }}
                renderRow={(c, _i, row) => (
                  <>
                    <FieldRow>
                      <Field label="Titlu" required error={tried && !String(c.title ?? '').trim() ? 'Completează titlul categoriei.' : undefined}>
                        <Input value={c.title ?? ''} onChange={(e) => row.update({ title: e.target.value })} />
                      </Field>
                      <Field label="Pictogramă" hint="Pictograma afișată lângă titlul categoriei (fără alegere: Layers)">
                        <Select
                          value={c.icon ?? ''}
                          options={ICON_OPTIONS}
                          placeholder="Fără pictogramă"
                          onChange={(v) => row.update({ icon: (v || null) as IconName | null })}
                        />
                      </Field>
                    </FieldRow>
                    <RulesTable rules={ruleList(c.rules)} onChange={(rules) => row.update({ rules })} />
                  </>
                )}
              />
            </EditorCard>
          </div>
        )}

        {!page.loading && !page.error && <SaveBar {...page.saveState.bar} onSave={save} onDiscard={discard} />}
      </Window>

      <UnsavedGuard when={form.dirty} />
    </AdminPage>
  );
};

export default RegulamentPage;
