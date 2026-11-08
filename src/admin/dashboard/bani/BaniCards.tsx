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
/** The two abonament cards link to today's lists, so they are links only for the current month (decided by Claude, 11-5 F5). */
export function BaniCards({ cards, month, current }: { cards: MoneyCards; month: string; current: boolean }) {
  const c = BANI_COPY.cards;
  const trend = trendText(cards.collected, cards.collectedPrev, addMonths(month, -1));
  const item = (to: string | null, label: string, value: React.ReactNode, caption: React.ReactNode) => {
    const tile = <StatTile label={label} value={value} caption={caption} />;
    return to === null ? <div key={label} className="bn-sq bn-sq--static">{tile}</div> : <Link key={label} to={to} className="bn-sq">{tile}</Link>;
  };
  return (
    <div className="bn-sq-grid">
      {item(platiMonthTo(month), c.collected, ron(cards.collected), trend)}
      {item(deIncasatMonthTo(month), c.left, ron(cards.left), BANI_COPY.dueOf(ron(cards.due)))}
      {item(current ? abonamenteStateTo('active') : null, c.active, cards.activeSubscriptions, BANI_COPY.athletesOf(cards.schoolAthletes))}
      {item(current ? abonamenteStateTo('expira14') : null, c.expiring, cards.expiring, expiringLine(cards.expiring))}
      {item(deIncasatMonthTo(month), c.unpaid, cards.unpaidAthletes, BANI_COPY.unpaidLine)}
    </div>
  );
}
