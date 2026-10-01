
/**
 * Pieces shared by the two inbox pages on InboxLayout (MesajePage and
 * FormResultsPage): date helpers, the list snippet and the reader-body /
 * toolbar stylesheet. The list row, the reader header and the day grouping
 * moved into src/admin/ui/InboxLayout (InboxRow, InboxReaderHead,
 * groupByDay). Before the move each page carried its own near-identical copy
 * (.mesg / .fres).
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

export function snippet(text: unknown): string {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > 90 ? `${t.slice(0, 90)}...` : t;
}

export const INBOX_CSS = `
.ui-root .inbx-sum{font-size:12px;color:var(--theme-text-muted);white-space:nowrap;font-variant-numeric:tabular-nums}
.ui-root .inbx-search{flex:1;min-width:170px}
.ui-root .ui-inbox-tools .ui-input{width:auto}
.ui-root .ui-inbox-tools .inbx-search .ui-input{width:100%}
.ui-root .inbx-bulk{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--theme-text-secondary);width:100%}
.ui-root .inbx-bulk b{color:var(--theme-primary);font-variant-numeric:tabular-nums}
.ui-root .inbx-bulk-acts{margin-left:auto;display:flex;gap:8px}
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
@media (max-width:640px){.ui-root .inbx-fld{flex-direction:column;gap:2px}.ui-root .inbx-fk{width:auto}}
`;
