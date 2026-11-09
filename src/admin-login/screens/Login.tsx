import * as React from 'react';
import { Button } from '../../admin/ui/Button';
import { Checkbox } from '../../admin/ui/Checkbox';
import { Field } from '../../admin/ui/Field';
import { Input } from '../../admin/ui/Input';
import { SECURITY_COPY, SECURITY_ERRORS } from '../../club/security/copy';
import type { Deps } from '../deps';
import { googleStartUrl, PATH, submitLogin } from '../flow';
import { PasswordInput } from '../PasswordInput';
import { Problem, Shell } from '../Shell';

const C = SECURITY_COPY.login;

/** `/intrare`: Google, e-mail and password, "Ține-mă minte". The passkey button and autofill come with the passkey task. */
export function Login({ post, go, handoff, search, flash }: Deps) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [rememberMe, setRememberMe] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const googleFailed = new URLSearchParams(search).get('eroare') === 'google';
  const shown = problem ?? flash ?? (googleFailed ? SECURITY_ERRORS.googleNoAccount : null);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const next = await submitLogin(post, { email, password, rememberMe });
    if (next.kind === 'handoff') return handoff(next.handoff);
    setBusy(false);
    if (next.kind === 'secondStep') return go(next.to, { email: next.email });
    setProblem(next.message);
  };

  return (
    <Shell title={C.title}>
      <Problem text={shown} />
      <a className="ui-btn ia-google" href={googleStartUrl(rememberMe)}>{C.google}</a>
      <p className="ia-or">{C.or}</p>
      <form className="ia-stack" onSubmit={(e) => void submit(e)}>
        <Field label={C.email}>
          <Input type="email" value={email} autoComplete="username" onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <PasswordInput label={C.password} value={password} autoComplete="current-password" onChange={setPassword} />
        <Checkbox checked={rememberMe} onChange={setRememberMe} label={C.remember} />
        <Button className="pce" type="submit" loading={busy} disabled={email.trim() === '' || password === ''}>{C.submit}</Button>
        <a className="ia-link" href={PATH.reset} onClick={(e) => { e.preventDefault(); go(PATH.reset); }}>{C.forgot}</a>
      </form>
    </Shell>
  );
}
