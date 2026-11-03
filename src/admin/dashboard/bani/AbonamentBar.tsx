import * as React from 'react';
import { SUBSCRIPTION_COPY } from '../../../club/presence/copy/subscriptions';
import { barSegments } from '../../../club/bani/format';
import type { AbonamentBar as Bar } from '../../../club/presence/subscriptions/rules';

type Props = { bar: Bar; goldLine?: boolean; compact?: boolean };

/** The abonament as a row of square segments, used ones filled (spec 5.7, 5.12). `compact` is the segments alone, for a list row or card. The screen loads MONEY_CSS. */
export function AbonamentBar({ bar, goldLine, compact }: Props) {
  const segs = (
    <div className={compact ? 'bn-bar-segs bn-bar-segs--compact' : 'bn-bar-segs'} aria-hidden="true">
      {barSegments(bar).map((used, i) => (
        <span key={i} className={`bn-seg${used ? ' bn-seg--used' : ''}`} />
      ))}
    </div>
  );
  if (compact) return segs;
  return (
    <div className="bn-bar">
      <div className="bn-bar-top">
        <span className="bn-bar-title">{SUBSCRIPTION_COPY.barTitle(bar.itemName, bar.slots)}</span>
        <span className="bn-bar-note">{SUBSCRIPTION_COPY.expiresOn(bar.validUntil)}</span>
      </div>
      {segs}
      <div className="bn-bar-foot">
        <span className="bn-bar-note">{SUBSCRIPTION_COPY.usedText(bar.used)}</span>
        <span className="bn-bar-note">{SUBSCRIPTION_COPY.leftText(Math.max(bar.slots - bar.used, 0))}</span>
      </div>
      {goldLine ? <span className="bn-bar-note">{SUBSCRIPTION_COPY.goldLine}</span> : null}
    </div>
  );
}
