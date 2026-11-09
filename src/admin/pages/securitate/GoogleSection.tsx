import * as React from 'react';
import { SECURITY_COPY } from '../../../club/security/copy';
import { Notice } from '../../ui/Notice';
import { Section } from '../../ui/Section';
import { adminToast } from '../../ui/Toast';
import { errorText } from './errors';
import type { SecurityApi } from './client';
import { Row, mutedStyle } from './layout';
import { PceButton } from './PceButton';

const C = SECURITY_COPY.google;

/** "Google": the linked address with "Elimină legătura", or "Neconectat." with the 2-Step Verification advice. */
export function GoogleSection({ api }: { api: SecurityApi }) {
  const [email, setEmail] = React.useState<string | null | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);
  const [asking, setAsking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    api.google().then((g) => live && setEmail(g.email)).catch((e) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
  }, [api]);

  const unlink = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setAsking(false);
    try {
      adminToast.success((await api.unlinkGoogle()).toast);
      setEmail(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={C.title}>
      {error && <Notice tone="danger">{error}</Notice>}
      {email && (
        <Row first>
          <span>{C.connected(email)}</span>
          {!asking && <PceButton variant="secondary" size="sm" loading={busy} onClick={() => setAsking(true)}>{C.unlink}</PceButton>}
        </Row>
      )}
      {email && asking && (
        <Row>
          <span>{C.confirmUnlink}</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <PceButton size="sm" loading={busy} onClick={() => void unlink()}>{C.confirmUnlinkYes}</PceButton>
            <PceButton variant="secondary" size="sm" disabled={busy} onClick={() => setAsking(false)}>{SECURITY_COPY.twoFactor.cancel}</PceButton>
          </span>
        </Row>
      )}
      {email === null && (
        <>
          <span>{C.notConnected}</span>
          <span style={mutedStyle}>{C.hint}</span>
        </>
      )}
    </Section>
  );
}
