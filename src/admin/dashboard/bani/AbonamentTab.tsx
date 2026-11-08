import * as React from 'react';
import { Button, Loading, Notice } from '../../ui';
import { groupLines } from '../../../club/bani/athlete-money-view';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { MONEY_UI_COPY } from '../../../club/presence/copy/money-ui';
import { CARD_COPY } from '../../../club/presence/copy/prezenta-ui';
import type { AthleteSubscriptionCards } from '../../../club/presence/money-api';
import { PREZENTA_CSS } from '../prezenta/styles';
import { SPORTIVI_CSS } from '../sportivi/styles';
import { useMoneyApi } from './api';
import { AbonamentCard } from './AbonamentCard';
import { AddSubscriptionWindow } from './AddSubscriptionWindow';
import { PresenceHistory } from './PresenceHistory';
import { MONEY_CSS } from './styles';
import { useLoad } from './useLoad';

type Athlete = { id: string; name: string };
const copy = MONEY_UI_COPY.athlete;

function Lines({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className="bn-block">
      <h3 className="spv-h">{title}</h3>
      <ul className="bn-lines">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </section>
  );
}

function Cards({ data, athleteId }: { data: AthleteSubscriptionCards; athleteId: string }) {
  const { current, others } = data;
  return (
    <>
      <Lines title={copy.groups} lines={groupLines(data)} />
      <section className="bn-block">
        <h3 className="spv-h">{CARD_COPY.current}</h3>
        {current.length === 0 ? <p className="spv-muted">{CARD_COPY.none}</p> : current.map((c) => <AbonamentCard key={c.id} card={c} athleteId={athleteId} />)}
      </section>
      {others.length > 0 && (
        <section className="bn-block">
          <h3 className="spv-h">{CARD_COPY.others}</h3>
          {others.map((c) => <AbonamentCard key={c.id} card={c} athleteId={athleteId} />)}
        </section>
      )}
    </>
  );
}

/** "Grupe și abonament" (5.4): groups, current and other abonamente with their days, "+ Adaugă abonament" and the presence history. */
export function AbonamentTab({ athlete, seasonId = null }: { athlete: Athlete; seasonId?: string | null }) {
  const api = useMoneyApi();
  const { data, failed } = useLoad<AthleteSubscriptionCards>(() => api.athleteSubscriptions(athlete.id, seasonId), `${athlete.id}|${seasonId}`);
  const [adding, setAdding] = React.useState(false);
  return (
    <div className="ui-body bn-tab">
      <style>{SPORTIVI_CSS + PREZENTA_CSS + MONEY_CSS}</style>
      {failed && <Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice>}
      {!data && !failed && <Loading />}
      {data && <Cards data={data} athleteId={athlete.id} />}
      <div><Button variant="secondary" onClick={() => setAdding(true)}>{copy.addSubscription}</Button></div>
      <PresenceHistory athlete={athlete} seasonId={seasonId} />
      {adding && <AddSubscriptionWindow athlete={athlete} onClose={() => setAdding(false)} />}
    </div>
  );
}
