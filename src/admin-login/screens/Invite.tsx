import * as React from 'react';
import { Button } from '../../admin/ui/Button';
import { Spinner } from '../../admin/ui/Spinner';
import { SECURITY_COPY, SECURITY_ERRORS } from '../../club/security/copy';
import { API } from '../api';
import type { Deps } from '../deps';
import { inviteGoogleUrl, PATH, submitInvite } from '../flow';
import { PasswordInput } from '../PasswordInput';
import { Problem, Shell } from '../Shell';

const C = SECURITY_COPY.invite;
type Read = { state: 'valid'; email: string } | { state: 'expired'; email: null };

/** `/intrare/invitatie?registrationToken=`: the invited e-mail read only, a new password or the same verified Google address. */
export function Invite({ post, go, handoff, search }: Deps) {
  const params = new URLSearchParams(search);
  const token = params.get('registrationToken') ?? '';
  const [invite, setInvite] = React.useState<Read | null>(null);
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (token === '') return setInvite({ state: 'expired', email: null });
    void post<Read>(API.inviteRead, { registrationToken: token }).then((r) => {
      if (r.ok) setInvite(r.data);
      else if (r.status === 429) setProblem(r.message);
      else setInvite({ state: 'expired', email: null });
    });
  }, [post, token]);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const next = await submitInvite(post, token, password);
    if (next.kind === 'handoff') return handoff(next.handoff);
    setBusy(false);
    if (next.kind === 'error') setProblem(next.message);
  };

  const googleFailed = params.get('eroare') === 'google' ? SECURITY_ERRORS.googleNoAccount : null;
  return (
    <Shell title={C.title}>
      <Problem text={problem ?? googleFailed} />
      {!invite && !problem && <Spinner size={24} />}
      {invite?.state === 'expired' && <p className="ia-text">{C.expired}</p>}
      {invite?.state === 'valid' && (
        <form className="ia-stack" onSubmit={(e) => void submit(e)}>
          <p className="ia-text">{C.account(invite.email)}</p>
          <PasswordInput label={C.newPassword} value={password} autoComplete="new-password" onChange={setPassword} />
          <Button className="pce" type="submit" loading={busy} disabled={password === ''}>{C.savePassword}</Button>
          <p className="ia-or">{C.or}</p>
          <a className="ui-btn ia-google" href={inviteGoogleUrl(token)}>{C.google}</a>
        </form>
      )}
      <a className="ia-link" href={PATH.login} onClick={(e) => { e.preventDefault(); go(PATH.login); }}>{SECURITY_COPY.reset.back}</a>
    </Shell>
  );
}
