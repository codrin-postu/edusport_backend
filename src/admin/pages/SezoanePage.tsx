import * as React from 'react';
import { AdminPage, Button, DataTable, Loading, Notice, PageHeader, StatusBadge, Window, useIsPhone, type DataColumn } from '../ui';
import { IconPlus } from '../ui/icons';
import { DASHBOARD_TO } from '../dashboard/menu';
import { formatPeriod, nextSeasonDraft, type AdminSeason } from '../../club/season-admin';
import { NEW_SEASON_COPY } from '../../club/groups/copy';
import { startableLabel } from '../../club/groups/new-season/detect';
import { GRUPE_CSS } from '../dashboard/grupe/styles';
import { SPORTIVI_CSS } from '../dashboard/sportivi/styles';
import { NewSeasonDialog } from './sezoane/NewSeasonDialog';
import { SeasonDrawer, type SeasonTarget } from './sezoane/SeasonDrawer';
import { useSeasons } from './sezoane/useSeasons';

/**
 * Sezoane (/plugins/edusport-sezoane): the club seasons (api::season), their period and membership
 * fee. "+ Sezon nou" creates a season that is not current; making a season current is phase 4.
 * Data and changes go through /api/club/seasons (history entries are written there).
 */
function StartButton({ s, onStart }: { s: AdminSeason; onStart: (s: AdminSeason) => void }) {
  return (
    <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); onStart(s); }}>{NEW_SEASON_COPY.button(s.label)}</Button>
  );
}

/** "Începe sezonul <next>" shows on the next season only (10.1); on phones it sits under the label. */
const columns = (startable: string | null, phone: boolean, onStart: (s: AdminSeason) => void): DataColumn<AdminSeason>[] => [
  { key: 'label', header: 'Sezon', render: (s) => (phone && s.label === startable ? <><div>{s.label}</div><StartButton s={s} onStart={onStart} /></> : s.label) },
  { key: 'period', header: 'Perioadă', render: (s) => formatPeriod(s.startMonth, s.endMonth) },
  { key: 'membershipFee', header: 'Taxă de membru', render: (s) => (s.membershipFee === null ? '-' : `${s.membershipFee} RON`) },
  { key: 'isCurrent', header: 'Curent', render: (s) => (s.isCurrent ? <StatusBadge tone="success">Curent</StatusBadge> : null) },
  ...(phone ? [] : [{ key: 'start', header: '', render: (s: AdminSeason) => (s.label === startable ? <StartButton s={s} onStart={onStart} /> : null) }]),
];

function SeasonsTable({ seasons, onOpen, onStart }: { seasons: AdminSeason[]; onOpen: (s: AdminSeason) => void; onStart: (s: AdminSeason) => void }) {
  const phone = useIsPhone();
  return (
    <div className="ui-body">
      <DataTable<AdminSeason> columns={columns(startableLabel(seasons), phone, onStart)} rows={seasons} getRowKey={(s) => s.documentId} onRowClick={onOpen} rowLabel={(s) => `Editează sezonul ${s.label}`} pageSize={0} empty="Niciun sezon" />
      <p className="ui-hint">Clic pe un rând deschide editarea lui într-un panou lateral.</p>
    </div>
  );
}

const SezoanePage: React.FC = () => {
  const { seasons, error, save } = useSeasons();
  const [target, setTarget] = React.useState<SeasonTarget | null>(null);
  const [starting, setStarting] = React.useState<AdminSeason | null>(null);
  const open = (s: AdminSeason) =>
    setTarget({ season: s, draft: { label: s.label, startMonth: s.startMonth, endMonth: s.endMonth, membershipFee: s.membershipFee } });
  const add = () => setTarget({ season: null, draft: nextSeasonDraft(seasons ?? []) });
  const action = (
    <Button variant="primary" size="sm" icon={<IconPlus />} onClick={add} disabled={!seasons}>
      Sezon nou
    </Button>
  );
  return (
    <AdminPage>
      <Window>
        <PageHeader back={{ to: DASHBOARD_TO }} title="Sezoane" subtitle="Sezoanele școlii, taxa de membru și sezonul curent." actions={action} />
        {error ? (
          <div className="ui-body"><Notice tone="danger">Nu am putut încărca sezoanele.</Notice></div>
        ) : seasons ? (
          <SeasonsTable seasons={seasons} onOpen={open} onStart={setStarting} />
        ) : (
          <Loading />
        )}
      </Window>
      <style>{SPORTIVI_CSS + GRUPE_CSS}</style>
      {starting && <NewSeasonDialog season={{ documentId: starting.documentId, label: starting.label }} onClose={() => setStarting(null)} />}
      <SeasonDrawer target={target} onSave={save} onClose={() => setTarget(null)} />
    </AdminPage>
  );
};

export default SezoanePage;
