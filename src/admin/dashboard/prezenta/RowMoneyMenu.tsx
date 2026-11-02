import * as React from 'react';
import { payPreselect, rowMenuItems, type RowMenuKey } from '../../../club/prezenta/panel-view';
import type { PanelRow, SectionKind } from '../../../club/presence/attendance/api-types';
import type { PaymentFor } from '../../../club/presence/payments/rules';
import { AddSubscriptionWindow } from '../bani/AddSubscriptionWindow';
import { useMoneyApi, type MoneyApi } from '../bani/api';
import { PaymentWindow } from '../bani/PaymentWindow';
import { RowMenu } from '../bani/RowMenu';

type Props = { row: PanelRow; kind: SectionKind; date: string };
type Opened = { kind: 'subscription' } | { kind: 'payment'; preselect: PaymentFor | null } | null;

/** The athlete's current abonament, for the "+ Plată" preselect; none when it cannot be read. */
async function currentSubscriptionId(api: MoneyApi, athleteId: string): Promise<string | null> {
  try {
    return (await api.athleteSubscriptions(athleteId, null)).bars[0]?.subscriptionId ?? null;
  } catch {
    return null;
  }
}

/** The "..." menu of a tick row (5.3, C44): "Adaugă abonament" (Școala) and "+ Plată", athlete locked. */
export function RowMoneyMenu({ row, kind, date }: Props) {
  const api = useMoneyApi();
  const [opened, setOpened] = React.useState<Opened>(null);
  const athlete = { id: row.athleteId, name: row.name };
  const pick = async (key: string) => {
    if (key === ('subscription' satisfies RowMenuKey)) return setOpened({ kind: 'subscription' });
    const subscriptionId = kind === 'school' ? await currentSubscriptionId(api, row.athleteId) : null;
    setOpened({ kind: 'payment', preselect: payPreselect(kind, date, subscriptionId) });
  };
  return (
    <>
      <RowMenu name={row.name} items={rowMenuItems(kind)} onPick={(key) => void pick(key)} />
      {opened?.kind === 'subscription' && <AddSubscriptionWindow athlete={athlete} onClose={() => setOpened(null)} />}
      {opened?.kind === 'payment' && <PaymentWindow mode="new" athlete={athlete} preselect={opened.preselect} onClose={() => setOpened(null)} />}
    </>
  );
}
