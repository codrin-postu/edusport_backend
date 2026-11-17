import * as React from 'react';
import { PHONE_BACK } from '../../../club/inscrieri-card';
import type { Row } from '../SubmissionTable';

/** Phone list: one card per registration; the card content comes from the page, a tap opens the detail. */
export function PhoneCards({ rows, onOpen, renderCard }: { rows: Row[]; onOpen: (id: string) => void; renderCard: (row: Row) => React.ReactNode }) {
  return (
    <div className="sbt-cards">
      {rows.map((r) => (
        <button key={r.documentId} type="button" className="sbt-card" onClick={() => onOpen(r.documentId)}>
          {renderCard(r)}
        </button>
      ))}
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
