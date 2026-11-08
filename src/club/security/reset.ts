import { safeMail } from './factors';
import type { SecurityContext } from './context';
import { SECURITY_ACTIONS } from './copy';
import type { Subject } from './store';

/**
 * Spec 6.6: an administrator (or the server line) clears the 2FA of a subject: factors and backup codes go, remembered devices are
 * forgotten, every session ends, the subject is told. Passkeys stay. Works without keys: nothing here opens a secret.
 */
export async function resetTwoFactor(c: SecurityContext, s: Subject, email: string, by: string | 'server'): Promise<void> {
  await c.store.transaction(async () => {
    await c.store.deleteFactors(s);
    await c.store.deleteBackup(s);
    await c.store.setSecurityNotes(s, {});
    await c.forgetDevices(s, {});
    await c.store.record({ subjectType: s.type, subjectId: s.id, action: SECURITY_ACTIONS.reset, changes: { by }, actor: by === 'server' ? c.actor : by });
  });
  await c.endSessions(s, {});
  await safeMail(c, email, 'reset2fa', {});
}
