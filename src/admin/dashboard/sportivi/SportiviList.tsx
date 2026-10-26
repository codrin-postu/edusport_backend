import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminPage, Button, PageHeader, Window, useIsPhone } from '../../ui';
import { IconPlus } from '../../ui/icons';
import { LIST_COPY, seasonValue } from '../../../club/sportivi/list-view';
import { SPORTIVI_PATH, athleteRecordTo, wantsAddAthlete } from '../../../club/sportivi/routes';
import { AddAthleteDialog } from './AddAthleteDialog';
import { useSportiviApi } from './api';
import { AthleteCards } from './AthleteCards';
import { AthleteTable } from './AthleteTable';
import { IncompleteBanner, ListToolbar } from './ListToolbar';
import { SPORTIVI_CSS } from './styles';
import { useAthleteList } from './useAthleteList';

/** The private list of every athlete (spec 5), replacing today's public-profile list. */
export function SportiviList() {
  const api = useSportiviApi();
  const phone = useIsPhone();
  const navigate = useNavigate();
  const { search } = useLocation();
  const list = useAthleteList(api, phone);
  const [adding, setAdding] = React.useState(() => wantsAddAthlete(search));
  const open = (documentId: string) =>
    navigate(athleteRecordTo(documentId), { state: { season: seasonValue(list.state, list.page) || null } });
  const closeAdd = () => {
    setAdding(false);
    if (wantsAddAthlete(search)) navigate(SPORTIVI_PATH, { replace: true });
  };
  const add = <Button icon={<IconPlus />} onClick={() => setAdding(true)}>{LIST_COPY.add}</Button>;
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS}</style>
      <Window>
        <PageHeader title={LIST_COPY.title} subtitle={LIST_COPY.subtitle} actions={add} />
        <ListToolbar list={list} phone={phone} />
        <IncompleteBanner list={list} />
        {phone ? <AthleteCards list={list} onOpen={open} /> : <AthleteTable list={list} onOpen={open} />}
      </Window>
      {adding && <AddAthleteDialog api={api} onClose={closeAdd} />}
    </AdminPage>
  );
}
