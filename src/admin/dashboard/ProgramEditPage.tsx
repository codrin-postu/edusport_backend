import * as React from 'react';
import { AdminPage, PageHeader, Section, StatusBadge, Window } from '../ui';
import { DASHBOARD_TO } from './menu';
import ProgramOverviewEditor from '../../plugins/component-preview/admin/src/ProgramOverviewEditor';
import { PAUZE_COPY } from '../../club/groups/copy';
import { SPORTIVI_CSS } from './sportivi/styles';
import { GRUPE_CSS } from './grupe/styles';
import { PauzeSection } from './program/PauzeSection';

/**
 * "Calendar și serii" (/plugins/edusport-program): Pauze, then the calendar, which writes calendar events itself.
 * The schedule series belong to the groups since phase 4 (spec 7.3); `program.scheduleGroups` stays in the database
 * as the notebook fallback and is no longer edited here, so the page needs no save bar.
 */
const ProgramEditPage: React.FC = () => (
  <AdminPage>
    <style>{SPORTIVI_CSS + GRUPE_CSS}</style>
    <Window>
      <PageHeader back={{ to: DASHBOARD_TO }} title="Program" subtitle="Calendarul sezonului și seriile de cursuri" />
      <div className="ui-body">
        <PauzeSection />
        <Section title={PAUZE_COPY.calendar} aside={<StatusBadge tone="neutral">{PAUZE_COPY.autosave}</StatusBadge>}>
          <ProgramOverviewEditor name="overview" attribute={{}} />
        </Section>
      </div>
    </Window>
  </AdminPage>
);

export default ProgramEditPage;
