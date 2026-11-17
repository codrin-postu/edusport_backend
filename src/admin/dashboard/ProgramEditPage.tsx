import * as React from 'react';
import { AdminPage, PageHeader, StatusBadge, Window, EditorCard } from '../ui';
import { DASHBOARD_TO } from './menu';
import ProgramOverviewEditor from '../../plugins/component-preview/admin/src/ProgramOverviewEditor';
import { PAUZE_COPY } from '../../club/groups/copy';
import { SPORTIVI_CSS } from './sportivi/styles';
import { GRUPE_CSS } from './grupe/styles';
import { AddPauzeButton, PauzeSection, type PauzeEdit } from './program/PauzeSection';
import { useBreaks } from './program/useBreaks';

/**
 * "Calendar și serii" (/plugins/edusport-program): Pauze, then the calendar, which writes calendar events itself.
 * The schedule series belong to the groups since phase 4 (spec 7.3); `program.scheduleGroups` stays in the database
 * as the notebook fallback and is no longer edited here, so the page needs no save bar.
 */
const ProgramEditPage: React.FC = () => {
  const breaks = useBreaks();
  const [edit, setEdit] = React.useState<PauzeEdit>(null);
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS + GRUPE_CSS}</style>
      <Window>
        <PageHeader back={{ to: DASHBOARD_TO }} title="Program" actions={<AddPauzeButton onAdd={() => setEdit({ target: null })} />} />
        <div className="ui-body">
          <PauzeSection breaks={breaks} edit={edit} setEdit={setEdit} />
          <EditorCard variant="plain" title={PAUZE_COPY.calendar} headerAction={<StatusBadge tone="neutral">{PAUZE_COPY.autosave}</StatusBadge>}>
            <ProgramOverviewEditor name="overview" attribute={{}} />
          </EditorCard>
        </div>
      </Window>
    </AdminPage>
  );
};

export default ProgramEditPage;
