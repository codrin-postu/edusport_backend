import * as React from 'react';
import { AdminPage, PageHeader, Window } from '../ui';
import { SHELL_COPY } from '../../club/presence/copy/prezenta-ui';

/** "De încasat": a shell until its phase 5 screen is built. */
export default function DeIncasatPage() {
  return (
    <AdminPage>
      <Window>
        <PageHeader title={SHELL_COPY.deIncasat} />
      </Window>
    </AdminPage>
  );
}
