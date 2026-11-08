import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../ConfirmDialog';
import { PANEL_LINKS, PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import { coachPageTo } from '../../../club/prezenta/routes';
import { athleteRecordTo } from '../../../club/sportivi/routes';

export type Follow = (to: string) => void;

/**
 * Same-tab links of a panel go through the close guard: with unsaved changes the admin is asked first, then the panel closes and the page changes.
 * A link to the page that is already open keeps its `location.state` (so Înapoi still goes where it did) and only closes the panel.
 */
export function useFollow(dirty: boolean, busy: boolean, onClose: () => void): { follow: Follow; dialog: React.ReactElement } {
  const location = useLocation();
  const navigate = useNavigate();
  const [pending, setPending] = React.useState<string | null>(null);
  const go = (to: string) => {
    const samePage = to.split('?')[0] === location.pathname;
    onClose();
    navigate(to, { state: samePage ? location.state : { from: `${location.pathname}${location.search}` } });
  };
  const follow: Follow = (to) => {
    if (busy) return;
    if (dirty) setPending(to);
    else go(to);
  };
  const dialog = (
    <ConfirmDialog
      open={pending !== null} title={PREZENTA_COPY.closeConfirm} message={null} tone="default" confirmLabel={PREZENTA_COPY.close} cancelLabel={PREZENTA_COPY.stay}
      onCancel={() => setPending(null)} onConfirm={() => { const to = pending; setPending(null); if (to !== null) go(to); }}
    />
  );
  return { follow, dialog };
}

type FollowLinkProps = { to: string; follow: Follow; className?: string; children: React.ReactNode };

/** A same-tab link: a plain click is handed to the guard; a modified click (new tab) keeps the browser's behaviour. */
export function FollowLink({ to, follow, className, children }: FollowLinkProps) {
  const onClick = (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    follow(to);
  };
  return <Link className={className} to={to} onClick={onClick}>{children}</Link>;
}

type CoachLinksProps = { coaches: { id: string; name: string }[]; date: string; follow: Follow };

/** "Antrenori: Ana, Dan": each name opens the coach page on the month of the date, in the same tab; Înapoi returns to where the panel was opened. */
export function CoachLinks({ coaches, date, follow }: CoachLinksProps) {
  if (coaches.length === 0) return null;
  return (
    <p className="pz-sheet-sub">
      {PANEL_LINKS.coaches}
      {coaches.map((c, i) => (
        <React.Fragment key={c.id}>
          {i > 0 && ', '}
          <FollowLink className="pz-name-link" to={coachPageTo(c.id, 'luna', date)} follow={follow}>{c.name}</FollowLink>
        </React.Fragment>
      ))}
    </p>
  );
}

/** An athlete's name: opens the record in a new tab, so the open panel is not lost. */
export function AthleteLink({ id, name }: { id: string; name: string }) {
  return <Link className="pz-name-link" to={athleteRecordTo(id)} target="_blank" rel="noopener">{name}</Link>;
}
