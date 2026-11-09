import * as React from 'react';
import { Button } from '../../admin/ui/Button';
import { Checkbox } from '../../admin/ui/Checkbox';
import { Field } from '../../admin/ui/Field';
import { Input } from '../../admin/ui/Input';
import type { TwoFactorMethod } from '../../club/security/api-types';
import { SECURITY_COPY } from '../../club/security/copy';
import type { Deps } from '../deps';
import { NEW_SECOND_STEP, parseSecondStepQuery, PATH, sendEmailCode, submitSecondStep } from '../flow';
import { Problem, Shell } from '../Shell';

const C = SECURITY_COPY.secondStep;

const fieldOf = (m: TwoFactorMethod): string => (m === 'totp' ? C.appField : m === 'email' ? C.emailField : C.backupField);
const promptOf = (m: TwoFactorMethod, sentTo: string | null): string | null => {
  if (m === 'totp') return C.appPrompt;
  if (m === 'backup') return C.backupPrompt;
  return sentTo ? C.emailSent(sentTo) : null;
};

/**
 * `/login/2fa`: the last used method first, "Altă metodă" for the rest. The address carries `last` and `methods` (also what the
 * Google first-link redirect sends, with `via=google` and no e-mail), so a reload keeps working: the pending login is the HttpOnly cookie.
 */
export function SecondStep({ post, go, handoff, search, email }: Deps) {
  const query = React.useMemo(() => parseSecondStepQuery(search), [search]);
  const [method, setMethod] = React.useState<TwoFactorMethod>(query?.last ?? NEW_SECOND_STEP.method);
  const [code, setCode] = React.useState('');
  const [remember, setRemember] = React.useState(NEW_SECOND_STEP.remember);
  const [listed, setListed] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(query?.last === 'email' ? email : null);
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!query) go(PATH.login);
  }, [query, go]);
  if (!query) return null;

  const sendCode = async (): Promise<void> => {
    setProblem(null);
    const sent = await sendEmailCode(post);
    if (sent.ok) setSentTo(sent.data.sentTo);
    else if (sent.status === 401) go(PATH.login, { flash: sent.message });
    else setProblem(sent.message);
  };

  const pick = (next: TwoFactorMethod): void => {
    setMethod(next);
    setCode('');
    setListed(false);
    setProblem(null);
    if (next === 'email') void sendCode();
  };

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const next = await submitSecondStep(post, { method, code, remember });
    if (next.kind === 'handoff') return handoff(next.handoff);
    setBusy(false);
    if (next.kind === 'expired') return go(PATH.login, { flash: next.message });
    if (next.kind === 'error') setProblem(next.message);
  };

  const prompt = promptOf(method, sentTo);
  const others = query.methods.filter((m) => m !== method);
  return (
    <Shell title={C.title}>
      <Problem text={problem} />
      <form className="ia-stack" onSubmit={(e) => void submit(e)}>
        {prompt && <p className="ia-text">{prompt}</p>}
        <Field label={fieldOf(method)}>
          <Input value={code} autoComplete="one-time-code" autoFocus onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Checkbox checked={remember} onChange={setRemember} label={C.remember} />
        <Button className="pce" type="submit" loading={busy} disabled={code.trim() === ''}>{C.verify}</Button>
        {method === 'email' && <Button className="pce" variant="ghost" onClick={() => void sendCode()}>{C.resend}</Button>}
        {others.length > 0 && <Button className="pce" variant="ghost" aria-expanded={listed} onClick={() => setListed(!listed)}>{C.otherMethod}</Button>}
        {listed && (
          <div className="ia-list">
            {others.map((m) => <Button key={m} className="pce" variant="secondary" onClick={() => pick(m)}>{C.methods[m]}</Button>)}
          </div>
        )}
        <a className="ia-link" href={PATH.login} onClick={(e) => { e.preventDefault(); go(PATH.login); }}>{C.back}</a>
      </form>
    </Shell>
  );
}
