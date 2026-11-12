import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminPage, Button, PageHeader, Window, useIsPhone } from '../../ui';
import { IconPlus } from '../../ui/icons';
import { LIST_COPY, inactiveShown, seasonValue } from '../../../club/sportivi/list-view';
import { selectionOn } from '../../../club/sportivi/personal-data-view';
import { SPORTIVI_PATH, athleteRecordTo, wantsAddAthlete } from '../../../club/sportivi/routes';
import { AddAthleteDialog } from './AddAthleteDialog';
import { useSportiviApi } from './api';
import { AthleteCards } from './AthleteCards';
import { AthleteTable } from './AthleteTable';
import { BulkAnonymizeBar } from './BulkAnonymizeBar';
import { BulkInviteBar } from './BulkInviteDialog';
import { ActiveFilters, IncompleteBanner, ListToolbar } from './ListToolbar';
import { SPORTIVI_CSS } from './styles';
import { useAthleteList } from './useAthleteList';
import { useInactiveLink, useSelection } from './useSelection';
import { useIsSuperAdmin } from './useSuperAdmin';

/** "Adaugă sportiv" open from the button or from the dashboard shortcut (`?adauga=1`). */
function useAddAthlete(search: string) {
  const navigate = useNavigate();
  const [adding, setAdding] = React.useState(() => wantsAddAthlete(search));
  const closeAdd = () => {
    setAdding(false);
    if (wantsAddAthlete(search)) navigate(SPORTIVI_PATH, { replace: true });
  };
  return { adding, startAdd: () => setAdding(true), closeAdd };
}

/** The private list of every athlete (spec 5), replacing today's public-profile list; 3C: the inactivity list and its bulk bar. */
export function SportiviList() {
  const api = useSportiviApi();
  const phone = useIsPhone();
  const navigate = useNavigate();
  const { search } = useLocation();
  const list = useAthleteList(api, phone);
  const selection = useSelection(list);
  const anonymizable = selectionOn(inactiveShown(list.state), useIsSuperAdmin());
  useInactiveLink(list, search);
  const { adding, startAdd, closeAdd } = useAddAthlete(search);
  const season = seasonValue(list.state, list.page) || null;
  const open = (documentId: string) => navigate(athleteRecordTo(documentId), { state: { season } });
  const add = <Button icon={<IconPlus />} onClick={startAdd}>{LIST_COPY.add}</Button>;
  return (
    <AdminPage fit>
      <style>{SPORTIVI_CSS}</style>
      <Window>
        <PageHeader title={LIST_COPY.title} subtitle={LIST_COPY.subtitle} actions={add} />
        <ListToolbar list={list} phone={phone} />
        <ActiveFilters list={list} phone={phone} />
        <IncompleteBanner list={list} />
        {selection.ids.size > 0 && <BulkInviteBar ids={[...selection.ids]} api={api} done={selection.done} />}
        {anonymizable && selection.ids.size > 0 && <BulkAnonymizeBar ids={[...selection.ids]} api={api} done={selection.done} />}
        {phone ? <AthleteCards list={list} onOpen={open} selection={selection} /> : <AthleteTable list={list} onOpen={open} selection={selection} />}
      </Window>
      {adding && <AddAthleteDialog api={api} season={season} onClose={closeAdd} />}
    </AdminPage>
  );
}
