import * as React from 'react';
import { AdminPage, PageHeader, Window } from '../ui';
import { PREZENTA_COPY } from '../../club/presence/copy/prezenta-ui';

/** "Prezență": the screen itself comes with 5-5 T3; until then the page is its header. */
export default function PrezentaPage() {
  return (
    <AdminPage>
      <Window>
        <PageHeader title={PREZENTA_COPY.title} />
      </Window>
    </AdminPage>
  );
}
