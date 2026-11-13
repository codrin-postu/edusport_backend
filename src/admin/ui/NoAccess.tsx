import * as React from 'react';
import { SECURITY_ERRORS } from '../../club/security/copy';
import { AdminPage } from './AdminPage';
import { EmptyState } from './EmptyState';

/** A page the caller's role does not cover, opened by its address. */
export function NoAccess() {
  return (
    <AdminPage>
      <EmptyState>{SECURITY_ERRORS.noAccess}</EmptyState>
    </AdminPage>
  );
}

export default NoAccess;
