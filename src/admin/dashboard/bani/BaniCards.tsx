import * as React from 'react';
import { Link } from 'react-router-dom';
import { StatTile } from '../../ui';
import { abonamenteStateTo, deIncasatMonthTo, platiMonthTo } from '../../../club/bani/routes';
import { expiringLine, trendText } from '../../../club/bani/money-view';
import { addMonths } from '../../../club/presence/dates';
import { BANI_COPY } from '../../../club/presence/copy/money-ui';
import { ron } from '../../../club/presence/money';
import type { MoneyCards } from '../../../club/money/types';

/** The five square cards; each one opens the page that shows the same figure. */
export function BaniCards({ cards, month }: { cards: MoneyCards; month: string }) {
  const c = BANI_COPY.cards;
  const trend = trendText(cards.collected, cards.collectedPrev, addMonths(month, -1));
  const item = (to: string, label: string, value: React.ReactNode, caption: React.ReactNode) => (
    <Link key={label} to={to} className="bn-sq"><StatTile label={label} value={value} caption={caption} /></Link>
  );
  return (
    <div className="bn-sq-grid">
      {item(platiMonthTo(month), c.collected, ron(cards.collected), <>{BANI_COPY.dueOf(ron(cards.due))}{trend && <span className="bn-trend">{trend}</span>}</>)}
      {item(deIncasatMonthTo(month), c.left, ron(cards.left), null)}
      {item(abonamenteStateTo('active'), c.active, cards.activeSubscriptions, BANI_COPY.athletesOf(cards.schoolAthletes))}
      {item(abonamenteStateTo('expira14'), c.expiring, cards.expiring, expiringLine(cards.expiring))}
      {item(deIncasatMonthTo(month), c.unpaid, cards.unpaidAthletes, BANI_COPY.unpaidLine)}
    </div>
  );
}
