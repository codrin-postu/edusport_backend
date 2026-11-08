import * as React from 'react';
import { IconChevronRight } from '../../ui/icons';
import { cardCount, cardName, cardPeriod, segments, useRow as rowOf } from '../../../club/bani/athlete-cards-view';
import { todayIso } from '../../../club/groups/http';
import { CARD_COPY } from '../../../club/presence/copy/prezenta-ui';
import type { SubscriptionCard } from '../../../club/presence/money-api';
import { SessionPanel } from '../prezenta/SessionPanel';

/** One abonament: code, name, period and state, the square segments with "3/8", and its dated days behind "Vezi zilele" (5.4.1). */
export function AbonamentCard({ card, athleteId }: { card: SubscriptionCard; athleteId: string }) {
  const [open, setOpen] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const today = todayIso();
  return (
    <div className="bn-card">
      <div className="bn-card-l1">
        {card.code && <span className="bn-card-code">{card.code}</span>}
        <span className="bn-card-name">{cardName(card.startsOn)}</span>
        <span className="bn-card-period">{cardPeriod(card.startsOn, card.validUntil, today)}</span>
        <span className="bn-state">{CARD_COPY.states[card.state]}</span>
      </div>
      <div className="bn-card-l2">
        <div className="bn-bar-segs bn-bar-segs--compact" aria-hidden="true">
          {segments(card.used, card.slots).map((used, i) => <span key={i} className={`bn-seg${used ? ' bn-seg--used' : ''}`} />)}
        </div>
        <span className="bn-card-count">{cardCount(card.used, card.slots)}</span>
        {card.used > 0 && (
          <button type="button" className="bn-days-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? CARD_COPY.hideDays : CARD_COPY.showDays}
          </button>
        )}
      </div>
      {open && (
        <ul className="bn-days">
          {card.uses.map((u) => {
            const row = rowOf(u, today);
            return (
              <li key={u.sessionId}>
                <button type="button" className="bn-day" onClick={() => setSessionId(u.sessionId)}>
                  <span className="bn-day-unit">{row.title}</span>
                  <span className="bn-day-when">{row.when}</span>
                  <span className="bn-day-group">{row.group}</span>
                  <span className="bn-day-chev" aria-hidden="true"><IconChevronRight /></span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {sessionId && <SessionPanel key={sessionId} target={{ id: sessionId }} highlightAthleteId={athleteId} onClose={() => setSessionId(null)} />}
    </div>
  );
}
