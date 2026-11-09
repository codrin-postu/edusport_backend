import * as React from 'react';
import { SECURITY_COPY } from '../../../club/security/copy';
import { Field } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { Notice } from '../../ui/Notice';
import { Section } from '../../ui/Section';
import { adminToast } from '../../ui/Toast';
import { errorText } from './errors';
import type { SecurityApi } from './client';
import { stackStyle } from './layout';
import { PceButton } from './PceButton';
import { afterPassword } from './state';

const C = SECURITY_COPY.password;

/** "Parolă": the current one and the new one. Others sign out; when this session ended too (`signedOut`) the page goes to `/intrare`. */
export function PasswordSection({ api, goTo }: { api: SecurityApi; goTo: (path: string) => void }) {
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const change = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const after = afterPassword(await api.changePassword({ current, password: next }));
      adminToast.success(after.toast);
      setCurrent('');
      setNext('');
      if (after.goTo) goTo(after.goTo);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={C.title}>
      {error && <Notice tone="danger">{error}</Notice>}
      <div style={stackStyle}>
        <Field label={C.current}>
          <Input type="password" value={current} autoComplete="current-password" onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label={C.next}>
          <Input type="password" value={next} autoComplete="new-password" onChange={(e) => setNext(e.target.value)} />
        </Field>
        <div>
          <PceButton loading={busy} disabled={current === '' || next === ''} onClick={() => void change()}>{C.change}</PceButton>
        </div>
      </div>
    </Section>
  );
}
