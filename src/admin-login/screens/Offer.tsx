import * as React from 'react';
import { Button } from '../../admin/ui/Button';
import { SECURITY_COPY } from '../../club/security/copy';
import { createPost } from '../api';
import type { Deps } from '../deps';
import { createOfferedKey, dismissOffer } from '../flow';
import { ADMIN_HOME } from '../handoff';
import { Problem, Shell } from '../Shell';

const C = SECURITY_COPY.offer;

/**
 * `/intrare/cheie`: shown once after a sign-in that answered `offerPasskey`, when the device has a built-in key. The token is already stored,
 * so both buttons end in `/admin`; "Nu acum" posts the dismissal first. A page opened by address (no token carried) goes straight to the admin.
 */
export function Offer({ token, webauthn }: Deps) {
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const authed = React.useMemo(
    () => (token ? createPost((input, init) => fetch(input, init), { Authorization: `Bearer ${token}` }) : null),
    [token],
  );
  const open = (): void => window.location.assign(ADMIN_HOME);

  React.useEffect(() => {
    if (!authed) open();
  }, [authed]);
  if (!authed) return null;

  const create = async (): Promise<void> => {
    setBusy(true);
    setProblem(null);
    const made = await createOfferedKey(authed, webauthn);
    if (made.ok) return open();
    setBusy(false);
    setProblem(made.message);
  };
  const skip = async (): Promise<void> => {
    setBusy(true);
    await dismissOffer(authed);
    open();
  };

  return (
    <Shell title={C.title}>
      <Problem text={problem} />
      <p className="ia-text">{C.line}</p>
      <div className="ia-stack">
        <Button className="pce" loading={busy} onClick={() => void create()}>{C.create}</Button>
        <Button className="pce" variant="secondary" disabled={busy} onClick={() => void skip()}>{C.notNow}</Button>
      </div>
    </Shell>
  );
}
