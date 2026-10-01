import * as React from 'react';
import type { InboxGroup } from '../ui';

/**
 * Pieces shared by the two inbox pages on InboxLayout (MesajePage and
 * FormResultsPage): date helpers, day grouping, the list row and the reader
 * header, plus their token-only stylesheet. Before the move each page carried
 * its own near-identical copy (.mesg / .fres).
 *
 * Kept free of backticks inside the CSS on purpose: one stray backtick in a
 * template literal takes the whole admin panel down to a blank page.
 */

export const RO_MON_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Compact, human relative time for list rows. */
export function relTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffS = Math.max(0, (now.getTime() - d.getTime()) / 1000);
  if (diffS < 60) return 'acum câteva secunde';
  if (diffS < 3600) return `acum ${Math.floor(diffS / 60)} min`;
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (d.toDateString() === now.toDateString()) {
    if (diffS < 6 * 3600) {
      const h = Math.floor(diffS / 3600);
      return `acum ${h} ${h === 1 ? 'oră' : 'ore'}`;
    }
    return `azi ${hm}`;
  }
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return `ieri ${hm}`;
  return `${d.getDate()} ${RO_MON_SHORT[d.getMonth()]}`;
}

/** Day-group label for the list separators. */
export function dayGroup(iso: string | null): string {
  if (!iso) return 'Fără dată';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Fără dată';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Azi';
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Ieri';
  return `${d.getDate()} ${RO_MON_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** Groups consecutive rows by day, preserving the server sort order. */
export function groupByDay<T>(rows: T[], when: (row: T) => string | null): InboxGroup<T>[] {
  const out: InboxGroup<T>[] = [];
  for (const r of rows) {
    const label = dayGroup(when(r));
    const last = out[out.length - 1];
    if (last && last.label === label) last.items.push(r);
    else out.push({ label, items: [r] });
  }
  return out;
}

export function snippet(text: unknown): string {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > 90 ? `${t.slice(0, 90)}...` : t;
}

export const INBOX_CSS = `
.ui-root .inbx-sum{font-size:12px;color:var(--theme-text-muted);white-space:nowrap;font-variant-numeric:tabular-nums}
.ui-root .inbx-search{flex:1;min-width:170px}
.ui-root .inbx-tools .ui-input{width:auto}
.ui-root .inbx-tools .inbx-search .ui-input{width:100%}
.ui-root .inbx-bulk{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--theme-text-secondary);width:100%}
.ui-root .inbx-bulk b{color:var(--theme-primary);font-variant-numeric:tabular-nums}
.ui-root .inbx-bulk-acts{margin-left:auto;display:flex;gap:8px}
.ui-root .inbx-li{display:flex;gap:10px;align-items:flex-start}
.ui-root .inbx-li-pick{flex-shrink:0;padding-top:1px}
.ui-root .inbx-li-bd{flex:1;min-width:0}
.ui-root .inbx-l1{display:flex;align-items:center;gap:7px}
.ui-root .inbx-l1 b{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
.ui-root .inbx-li[data-unread="true"] .inbx-l1 b{font-weight:800}
.ui-root .inbx-dot{width:6px;height:6px;background:var(--theme-danger);flex-shrink:0}
.ui-root .inbx-tm{margin-left:auto;font-size:10px;color:var(--theme-text-muted);flex-shrink:0}
.ui-root .inbx-snip{font-size:11.5px;color:var(--theme-text-muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ui-root .inbx-chips{margin-top:5px}
.ui-root .inbx-rh{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--theme-border-subtle)}
.ui-root .inbx-rh h3{margin:0;font-size:16px;font-weight:800;color:var(--theme-text)}
.ui-root .inbx-meta{font-size:12px;color:var(--theme-text-muted);margin-top:3px}
.ui-root .inbx-meta a{color:var(--theme-primary);text-decoration:none}
.ui-root .inbx-meta a:hover{text-decoration:underline}
.ui-root .inbx-msg{font-size:13.5px;color:var(--theme-text);line-height:1.6;padding:13px 0;border-bottom:1px solid var(--theme-border-subtle);white-space:pre-wrap;word-break:break-word}
.ui-root .inbx-flds{padding:12px 0;border-bottom:1px solid var(--theme-border-subtle)}
.ui-root .inbx-fld{display:flex;gap:12px;padding:5px 0;font-size:13px}
.ui-root .inbx-fk{width:170px;flex-shrink:0;color:var(--theme-text-muted);font-size:12px;padding-top:1px}
.ui-root .inbx-fv{flex:1;min-width:0;color:var(--theme-text);word-break:break-word}
.ui-root .inbx-fv--long{white-space:pre-wrap;line-height:1.55}
.ui-root .inbx-cap{font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--theme-text-muted);font-weight:700;margin:13px 0 6px}
.ui-root .inbx-form{display:flex;flex-direction:column;gap:12px;margin-top:13px}
.ui-root .inbx-form .ui-field select.ui-input{width:auto;min-width:200px}
.ui-root .inbx-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.ui-root a.ui-btn{text-decoration:none}
@media (max-width:640px){.ui-root .inbx-fld{flex-direction:column;gap:2px}.ui-root .inbx-fk{width:auto}}
`;

export interface InboxRowProps {
  title: React.ReactNode;
  time: string;
  unread: boolean;
  snippet?: string;
  badge?: React.ReactNode;
  /** Leading control (e.g. a bulk-select Checkbox). Clicks on it do not open the row. */
  lead?: React.ReactNode;
}

/** Row content for InboxLayout.renderItem. */
export function InboxRow({ title, time, unread, snippet: snip, badge, lead }: InboxRowProps) {
  return (
    <div className="inbx-li" data-unread={unread ? 'true' : 'false'}>
      {lead && (
        // The row itself is a button (InboxLayout); keep picks from opening it.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <span className="inbx-li-pick" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {lead}
        </span>
      )}
      <div className="inbx-li-bd">
        <div className="inbx-l1">
          {unread && <span className="inbx-dot" aria-label="Necitit" />}
          <b>{title}</b>
          <span className="inbx-tm">{time}</span>
        </div>
        {snip ? <div className="inbx-snip">{snip}</div> : null}
        {badge && <div className="inbx-chips">{badge}</div>}
      </div>
    </div>
  );
}

/** Reader header: name, meta lines, badge on the right. */
export function ReaderHead({ title, meta, badge }: { title: React.ReactNode; meta: React.ReactNode[]; badge?: React.ReactNode }) {
  return (
    <div className="inbx-rh">
      <div>
        <h3>{title}</h3>
        {meta.filter(Boolean).map((m, i) => (
          <div className="inbx-meta" key={i}>
            {m}
          </div>
        ))}
      </div>
      {badge}
    </div>
  );
}
