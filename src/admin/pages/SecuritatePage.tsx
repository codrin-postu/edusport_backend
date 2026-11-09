import * as React from 'react';
import { SECURITY_COPY } from '../../club/security/copy';
import { useIsSuperAdmin } from '../dashboard/sportivi/useSuperAdmin';
import { AdminPage } from '../ui/AdminPage';
import { PageHeader } from '../ui/PageHeader';
import { Section } from '../ui/Section';
import { useSecurityApi } from './securitate/api';
import { AdminsSection } from './securitate/AdminsSection';
import { DevicesSection } from './securitate/DevicesSection';
import { GoogleSection } from './securitate/GoogleSection';
import { PasswordSection } from './securitate/PasswordSection';
import { TwoFactorSection } from './securitate/TwoFactorSection';

/** The session ended (password change on a device we cannot tell apart, this device disconnected): the sign-in page. */
const goTo = (path: string): void => window.location.replace(path);

/**
 * Admin "Securitate" (spec 10.4, route /plugins/edusport-securitate): 2FA, access keys (added with the passkey task), password, Google,
 * devices, and for a Super Admin "Administratori". The server routes are the authority; `useIsSuperAdmin` only hides the section.
 * Every button goes through PceButton, which opts it out of the SaveBar tagger.
 */
export default function SecuritatePage() {
  const api = useSecurityApi();
  const superAdmin = useIsSuperAdmin();
  return (
    <AdminPage>
      <PageHeader title={SECURITY_COPY.page.title} />
      <TwoFactorSection api={api} />
      {/* The passkey list and its button arrive with the passkey task; until then only the header stands. */}
      <Section title={SECURITY_COPY.passkeys.title}>{null}</Section>
      <PasswordSection api={api} goTo={goTo} />
      <GoogleSection api={api} />
      <DevicesSection api={api} goTo={goTo} />
      {superAdmin && <AdminsSection api={api} />}
    </AdminPage>
  );
}
