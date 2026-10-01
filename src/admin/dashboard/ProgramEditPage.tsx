import * as React from 'react';
import { AdminPage, Window, PageHeader, Section, Notice, Loading, SaveBar, UnsavedGuard, StatusBadge } from '../ui';
import { useSingleType, usePageForm } from '../lib';
import { DASHBOARD_TO } from './menu';
import ProgramOverviewEditor from '../../plugins/component-preview/admin/src/ProgramOverviewEditor';
import { ScheduleGroupsInner } from '../../plugins/component-preview/admin/src/ScheduleGroupsEditor';

/**
 * EduSport admin — custom "Program" page, replacing the stock single-type view
 * for api::program.program.
 *
 * The point of moving off the content-manager: its edit view puts the form in
 * a grid column beside a right rail, which is what squeezed the calendar. Here
 * there is no such grid.
 *
 * The fields persist differently, which is why the save bar covers only
 * one of them:
 *
 *   overview        ProgramOverviewEditor writes calendar-event records
 *                   straight to the API as you go, so it needs no value and no
 *                   page save. It is rendered as-is.
 *   scheduleGroups  owned by this page, saved with the floating save bar.
 *   calendarEvents  legacy fallback the site still reads when the occurrences
 *                   endpoint returns nothing. Deliberately NOT editable here:
 *                   it is old-season data nobody should be hand-editing.
 *                   useSingleType sends only the attributes that changed, so
 *                   the stored value is never touched.
 */

const UID_PROGRAM = 'api::program.program';

interface Program {
  scheduleGroups: unknown[] | null;
}

// Stable empty value: ScheduleGroupsInner resyncs whenever `value` changes identity.
const NO_GROUPS: unknown[] = [];

const ProgramEditPage: React.FC = () => {
  const page = useSingleType<Program>(UID_PROGRAM);
  const form = usePageForm<Program>(page.data, page.saveState);
  const groups = Array.isArray(form.value.scheduleGroups) ? form.value.scheduleGroups : NO_GROUPS;

  return (
    <AdminPage>
      <Window>
        <PageHeader back={{ to: DASHBOARD_TO }} title="Program" subtitle="Calendarul sezonului și seriile de cursuri" />

        {page.loading ? (
          <Loading />
        ) : page.error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca programul.</Notice>
          </div>
        ) : (
          <div className="ui-body">
            <Section title="Calendar" aside={<StatusBadge tone="neutral">se salvează automat</StatusBadge>}>
              {/* Self-contained: writes calendar-event records itself. */}
              <ProgramOverviewEditor name="overview" attribute={{}} />
            </Section>

            <Section title="Serii de cursuri Școala de Patinaj">
              <ScheduleGroupsInner value={groups} onChange={(next) => form.set('scheduleGroups', next as unknown[])} />
            </Section>
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

export default ProgramEditPage;
