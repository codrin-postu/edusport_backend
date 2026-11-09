import * as React from 'react';
import { Button } from '../../admin/ui/Button';
import { Field } from '../../admin/ui/Field';
import { Input } from '../../admin/ui/Input';
import { Notice } from '../../admin/ui/Notice';
import { SECURITY_COPY } from '../../club/security/copy';
import { API } from '../api';
import type { Deps } from '../deps';
import { PATH, submitResetConfirm } from '../flow';
import { PasswordInput } from '../PasswordInput';
import { Problem, Shell } from '../Shell';

const C = SECURITY_COPY.reset;

/** `/forgot-password`: e-mail, "Trimite codul", then the code and a new password (spec 4.7). */
export function Reset({ post, go, handoff }: Deps) {
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  const request = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const r = await post<{ message: string }>(API.resetRequest, { email: email.trim() });
    setBusy(false);
    if (r.ok) setSent(true);
    else setProblem(r.message);
  };

  const confirm = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const next = await submitResetConfirm(post, { email, code, password });
    if (next.kind === 'handoff') return handoff(next.handoff);
    setBusy(false);
    if (next.kind === 'secondStep') return go(next.to, { email: next.email });
    if (next.kind === 'error') setProblem(next.message);
  };

  return (
    <Shell title={SECURITY_COPY.login.forgot}>
      <Problem text={problem} />
      {sent && <Notice tone="success">{C.sent}</Notice>}
      {!sent && (
        <form className="ia-stack" onSubmit={(e) => void request(e)}>
          <Field label={SECURITY_COPY.login.email}>
            <Input type="email" value={email} autoComplete="username" onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button className="pce" type="submit" loading={busy} disabled={email.trim() === ''}>{C.sendCode}</Button>
        </form>
      )}
      {sent && (
        <form className="ia-stack" onSubmit={(e) => void confirm(e)}>
          <Field label={C.codeField}>
            <Input value={code} autoComplete="one-time-code" onChange={(e) => setCode(e.target.value)} />
          </Field>
          <PasswordInput label={C.newPassword} value={password} autoComplete="new-password" onChange={setPassword} />
          <Button className="pce" type="submit" loading={busy} disabled={code.trim() === '' || password === ''}>{C.savePassword}</Button>
        </form>
      )}
      <a className="ia-link" href={PATH.login} onClick={(e) => { e.preventDefault(); go(PATH.login); }}>{C.back}</a>
    </Shell>
  );
}
