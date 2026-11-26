import * as React from 'react';
import { WELCOME_COPY } from '../../club/onboarding/copy';
import type { WelcomeRole } from '../../club/onboarding/role';
import { Button, Modal } from '../ui';

/** First-load welcome: role line, duration line, "Mai târziu" and "Începe". Closing it any other way counts as later. */
export function WelcomeDialog({ firstName, role, onLater, onStart }: { firstName: string; role: WelcomeRole; onLater: () => void; onStart: () => void }) {
  return (
    <Modal
      open
      onClose={onLater}
      title={WELCOME_COPY.title(firstName)}
      footer={
        <>
          <Button variant="secondary" onClick={onLater}>{WELCOME_COPY.later}</Button>
          <Button onClick={onStart}>{WELCOME_COPY.start}</Button>
        </>
      }
    >
      <p>{WELCOME_COPY.line[role]}</p>
      <p>{WELCOME_COPY.duration}</p>
    </Modal>
  );
}
