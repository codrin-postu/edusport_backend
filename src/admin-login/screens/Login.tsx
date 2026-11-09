import * as React from 'react';
import { Button } from '../../admin/ui/Button';
import { Checkbox } from '../../admin/ui/Checkbox';
import { Field } from '../../admin/ui/Field';
import { Input } from '../../admin/ui/Input';
import { SECURITY_COPY, SECURITY_ERRORS } from '../../club/security/copy';
import type { Deps } from '../deps';
import { googleStartUrl, PATH, signInWithKey, submitLogin } from '../flow';
import { PasswordInput } from '../PasswordInput';
import { Problem, Shell } from '../Shell';

const C = SECURITY_COPY.login;

/**
 * `/login`: Google, e-mail and password, "Ține-mă minte", and where the browser supports it the key button under "Intră" and the autofill on
 * "E-mail" (a conditional request started on mount, aborted when the button flow starts).
 */
export function Login({ post, go, handoff, search, flash, webauthn }: Deps) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [rememberMe, setRememberMe] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const googleFailed = new URLSearchParams(search).get('error') === 'google';
  const shown = problem ?? flash ?? (googleFailed ? SECURITY_ERRORS.googleNoAccount : null);

  const autofill = React.useRef<AbortController | null>(null);
  // The autofill request picks the box up when the key is chosen, not when the page opened.
  const rememberRef = React.useRef(false);
  rememberRef.current = rememberMe;
  const finishKey = React.useCallback(async (opts: { conditional?: boolean; signal?: AbortSignal }): Promise<void> => {
    const next = await signInWithKey(post, webauthn, () => rememberRef.current, opts);
    if (next === null) return;
    if (next.kind === 'handoff') return handoff(next.handoff);
    setBusy(false);
    if (next.kind === 'error' || next.kind === 'expired') setProblem(next.message);
  }, [post, webauthn, handoff]);

  React.useEffect(() => {
    if (!webauthn.supported) return undefined;
    const control = new AbortController();
    let live = true;
    void webauthn.autofill().then((yes) => {
      if (!live || !yes) return;
      autofill.current = control;
      void finishKey({ conditional: true, signal: control.signal });
    });
    return () => {
      live = false;
      control.abort();
    };
  }, [webauthn, finishKey]);

  const useKey = async (): Promise<void> => {
    autofill.current?.abort();
    setBusy(true);
    setProblem(null);
    await finishKey({});
  };

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
          <Input type="email" value={email} autoComplete={webauthn.supported ? 'username webauthn' : 'username'} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <PasswordInput label={C.password} value={password} autoComplete="current-password" onChange={setPassword} />
        <Checkbox checked={rememberMe} onChange={setRememberMe} label={C.remember} />
        <Button className="pce" type="submit" loading={busy} disabled={email.trim() === '' || password === ''}>{C.submit}</Button>
        {webauthn.supported && <Button className="pce" variant="secondary" type="button" disabled={busy} onClick={() => void useKey()}>{C.passkey}</Button>}
        <a className="ia-link" href={PATH.reset} onClick={(e) => { e.preventDefault(); go(PATH.reset); }}>{C.forgot}</a>
      </form>
    </Shell>
  );
}
