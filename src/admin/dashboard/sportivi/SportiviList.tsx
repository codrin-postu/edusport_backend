import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminPage, PageHeader, Window, useIsPhone } from '../../ui';
import { LIST_COPY, seasonValue } from '../../../club/sportivi/list-view';
import { athleteRecordTo } from '../../../club/sportivi/routes';
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
  const list = useAthleteList(api, phone);
  const open = (documentId: string) =>
    navigate(athleteRecordTo(documentId), { state: { season: seasonValue(list.state, list.page) || null } });
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS}</style>
      <Window>
        <PageHeader title={LIST_COPY.title} subtitle={LIST_COPY.subtitle} />
        <ListToolbar list={list} phone={phone} />
        <IncompleteBanner list={list} />
        {phone ? <AthleteCards list={list} onOpen={open} /> : <AthleteTable list={list} onOpen={open} />}
      </Window>
    </AdminPage>
  );
}
