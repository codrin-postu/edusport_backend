import * as React from 'react';
import { AdminPage, PageHeader, Window } from '../ui';
import { SHELL_COPY } from '../../club/presence/copy/prezenta-ui';

/** "Plăți": a shell until its phase 5 screen is built. */
export default function PlatiPage() {
  return (
    <AdminPage>
      <Window>
        <PageHeader title={SHELL_COPY.plati} />
      </Window>
    </AdminPage>
  );
}
