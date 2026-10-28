import * as React from 'react';
import { AdminPage, PageHeader, Window } from '../ui';
import { SHELL_COPY } from '../../club/presence/copy/prezenta-ui';

/** "Abonamente": a shell until its phase 5 screen is built. */
export default function AbonamentePage() {
  return (
    <AdminPage>
      <Window>
        <PageHeader title={SHELL_COPY.abonamente} subtitle={SHELL_COPY.abonamenteSub} />
      </Window>
    </AdminPage>
  );
}
