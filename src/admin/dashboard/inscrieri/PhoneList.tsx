import * as React from 'react';
import { PHONE_BACK } from '../../../club/inscrieri-card';
import type { Row } from '../SubmissionTable';

/** Phone selection mode: which cards are ticked and how a tap toggles one. */
export type PhoneSelection = { ids: Set<string>; toggle: (id: string) => void };

/** Phone list: one card per registration; the card content comes from the page, a tap opens the detail (or ticks the card while selecting). */
export function PhoneCards({ rows, onOpen, renderCard, selection, rowAnchor }: { rows: Row[]; onOpen: (id: string) => void; renderCard: (row: Row) => React.ReactNode; selection?: PhoneSelection; rowAnchor?: (row: Row) => string | undefined }) {
  return (
    <div className={selection ? 'sbt-cards sbt-cards--sel' : 'sbt-cards'}>
      {rows.map((r) => {
        const on = selection?.ids.has(r.documentId) ?? false;
        return (
          <button
            key={r.documentId}
            type="button"
            data-tour={rowAnchor?.(r)}
            className={on ? 'sbt-card sbt-card--on' : 'sbt-card'}
            aria-pressed={selection ? on : undefined}
            onClick={() => (selection ? selection.toggle(r.documentId) : onOpen(r.documentId))}
          >
            {selection && <span className="sbt-cardcheck" aria-hidden="true" />}
            {selection ? <span className="sbt-cardbody">{renderCard(r)}</span> : renderCard(r)}
          </button>
        );
      })}
    </div>
  );
}

/** Phone detail: a full-screen layer over the list (which stays mounted, so its scroll position survives) with the back link on top. */
export function PhoneDetail({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="sbt-pdetail" role="dialog" aria-modal="true">
      <div className="ins-back">
        <button type="button" className="ins-link" onClick={onBack}>
          {PHONE_BACK}
        </button>
      </div>
      {children}
    </div>
  );
}
