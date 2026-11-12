import * as React from 'react';
import { StatTile } from '../../ui';
import type { ContabTab } from '../../../club/contabilitate/routes';
import { expiringLine, trendText } from '../../../club/bani/money-view';
import { addMonths } from '../../../club/presence/dates';
import { BANI_COPY } from '../../../club/presence/copy/money-ui';
import { ron } from '../../../club/presence/money';
import type { MoneyCards } from '../../../club/money/types';

export type CardTarget = { tab: ContabTab; params: Record<string, string> };

/** The five cards; each one switches to the tab that shows the same figure, with its filter set. The two abonament cards open today's lists, so they act only for the current month (decided by Claude, 11-5 F5). */
export function BaniCards({ cards, month, current, onOpen }: { cards: MoneyCards; month: string; current: boolean; onOpen: (tab: ContabTab, params: Record<string, string>) => void }) {
  const c = BANI_COPY.cards;
  const trend = trendText(cards.collected, cards.collectedPrev, addMonths(month, -1));
  const item = (to: CardTarget | null, label: string, value: React.ReactNode, caption: React.ReactNode) => {
    const tile = <StatTile label={label} value={value} caption={caption} />;
    return to === null
      ? <div key={label} className="bn-sq bn-sq--static">{tile}</div>
      : <button key={label} type="button" className="bn-sq" onClick={() => onOpen(to.tab, to.params)}>{tile}</button>;
  };
  return (
    <div className="bn-sq-grid">
      {item({ tab: 'plati', params: {} }, c.collected, ron(cards.collected), trend)}
      {item({ tab: 'restante', params: {} }, c.left, ron(cards.left), BANI_COPY.dueOf(ron(cards.due)))}
      {item(current ? { tab: 'abonamente', params: { state: 'active' } } : null, c.active, cards.activeSubscriptions, BANI_COPY.athletesOf(cards.schoolAthletes))}
      {item(current ? { tab: 'abonamente', params: { state: 'expira14' } } : null, c.expiring, cards.expiring, expiringLine(cards.expiring))}
      {item({ tab: 'restante', params: {} }, c.unpaid, cards.unpaidAthletes, BANI_COPY.unpaidLine)}
    </div>
  );
}
