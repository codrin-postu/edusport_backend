import * as React from 'react';
import { Link } from 'react-router-dom';
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
  LinkOutCard,
  RepeatableList,
  Field,
  Textarea,
  adminToast,
  normalizeObject,
} from '../ui';
import { useSingleType, usePageForm } from '../lib';
import { DASHBOARD_TO, PROGRAM_EDIT_TO } from '../dashboard/menu';
import { SETARI_SITE_TO, UID } from './routes';

/**
 * Pagina Program (/cursuri/program on the site): the program-page single type.
 *
 * Replaces the content-manager view, whose layout (src/index.ts) shows four
 * fields, rebuilt here field for field:
 *   calendarLink  CalendarLink: a link to Calendar și serii (PROGRAM_EDIT_TO),
 *                 no value of its own.
 *   banner        PageBannerEditor, JSON { title, subtitle }.
 *   pageInfo      ProgramPageInfoEditor, JSON { scheduleSubtitle }, plus the
 *                 pointer to Setări site for the season label and dates.
 *   disclaimers   repeatable shared.disclaimer { text (required) }, the
 *                 "Notificări importante" list.
 *
 * scheduleGroups and calendarEvents are legacy copies on this type: the
 * schedule series and the calendar live on the Program single type (Calendar
 * și serii), the content-manager layout leaves them out, and the site only
 * falls back to them when Program has none. They are not shown here and never
 * sent (save sends only changed attributes), so their stored values stay.
 */

interface Banner {
  title: string;
  subtitle: string;
}

interface PageInfo {
  scheduleSubtitle: string;
}

interface Disclaimer {
  id?: number;
  /** Local key for a row not saved yet (dropped by the serializer). */
  __temp_key__?: string;
  text: string;
}

interface ProgramPage {
  banner: Banner | null;
  pageInfo: PageInfo | null;
  disclaimers: Disclaimer[] | null;
}

const EMPTY_BANNER: Banner = { title: '', subtitle: '' };
const EMPTY_INFO: PageInfo = { scheduleSubtitle: '' };

let tempSeq = 0;
const newDisclaimer = (): Disclaimer => ({ __temp_key__: `new-${Date.now()}-${++tempSeq}`, text: '' });
const disclaimerKey = (d: Disclaimer, i: number): string | number => d.id ?? d.__temp_key__ ?? `i-${i}`;

const PaginaProgramPage: React.FC = () => {
  const page = useSingleType<ProgramPage>(UID.programPage);
  const form = usePageForm<ProgramPage>(page.data, page.saveState);
  const [showErrors, setShowErrors] = React.useState(false);

  const banner = normalizeObject<Banner>(form.value.banner, EMPTY_BANNER);
  const info = normalizeObject<PageInfo>(form.value.pageInfo, EMPTY_INFO);
  const disclaimers = Array.isArray(form.value.disclaimers) ? form.value.disclaimers : [];
  const hasEmpty = disclaimers.some((d) => !(d.text ?? '').trim());

  const save = () => {
    if (hasEmpty) {
      setShowErrors(true);
      adminToast.error('Completează textul fiecărei notificări sau șterge notificările goale.');
      return;
    }
    setShowErrors(false);
    void page.save(form.value);
  };

  const discard = () => {
    setShowErrors(false);
    form.reset();
  };

  return (
    <AdminPage>
      <Window>
        <PageHeader
          back={{ to: DASHBOARD_TO }}
          title="Pagina Program"
          subtitle="Bannerul, subtitlul orarului și notificările de pe pagina /cursuri/program"
        />

        {page.loading ? (
          <Loading />
        ) : page.error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca pagina programului.</Notice>
          </div>
        ) : (
          <div className="ui-body">
            <LinkOutCard
              title="Calendar și serii"
              description="Calendarul sezonului și seriile de curs se editează în pagina Program, nu aici."
              body="Aici poți edita datele pentru școala de patinaj și alte evenimente."
              href={`/admin${PROGRAM_EDIT_TO}`}
              linkLabel="Deschide Calendar și serii"
            />

            <ObjectFieldCard<Banner>
              title="Banner Pagină"
              description="Titlul și subtitlul afișate în banner-ul din partea de sus a paginii."
              value={banner}
              onFieldChange={(key, v) => form.set('banner', { ...banner, [key]: v })}
              fields={[
                { key: 'title', label: 'Titlu', hint: 'Titlul mare afișat în banner', placeholder: 'ex: Echipa noastră', span: 2 },
                {
                  key: 'subtitle',
                  label: 'Subtitlu',
                  hint: 'Textul descriptiv de sub titlu',
                  type: 'textarea',
                  rows: 3,
                  placeholder: 'ex: Antrenorii și instructorii care ghidează cursanții...',
                },
              ]}
            />

            <ObjectFieldCard<PageInfo>
              title="Pagina Program - Informații"
              description="Subtitlul orarului afișat pe /cursuri/program. Etichetele și datele de sezon sunt setate global în Setări Site."
              value={info}
              onFieldChange={(key, v) => form.set('pageInfo', { ...info, [key]: v })}
              fields={[
                {
                  key: 'scheduleSubtitle',
                  label: 'Subtitlu orar',
                  hint: 'Textul de sub titlul secțiunii de orar',
                  placeholder: 'ex: Cursuri în fiecare weekend',
                  span: 2,
                },
              ]}
            >
              <Notice
                tone="info"
                title="Etichetă și date sezon"
                action={
                  <Link className="ui-btn ui-btn--secondary ui-btn--sm" to={SETARI_SITE_TO}>
                    Editează sezonul în Setări Site
                  </Link>
                }
              >
                Setate o singură dată în Setări Site → Înscrieri & Sezon. Apar automat pe pagina Program și în calendar.
              </Notice>
            </ObjectFieldCard>

            <EditorCard
              title="Notificări importante"
              description="Notificările afișate pe pagina Program, în ordinea de aici."
            >
              <RepeatableList<Disclaimer>
                items={disclaimers}
                onChange={(next) => form.set('disclaimers', next)}
                getKey={disclaimerKey}
                newItem={newDisclaimer}
                addLabel="Adaugă notificare"
                emptyLabel="Nicio notificare adăugată."
                itemLabel={(_, i) => `notificarea ${i + 1}`}
                reorder
                confirmDelete
                aria-label="Notificări importante"
                renderRow={(d, i, { update }) => {
                  const empty = !(d.text ?? '').trim();
                  return (
                    <Field
                      label={`Text notificare ${i + 1}`}
                      required
                      error={showErrors && empty ? 'Textul notificării este obligatoriu.' : undefined}
                    >
                      <Textarea
                        value={d.text ?? ''}
                        rows={2}
                        placeholder="Textul notificării…"
                        onChange={(e) => update({ text: e.target.value })}
                      />
                    </Field>
                  );
                }}
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

export default PaginaProgramPage;
