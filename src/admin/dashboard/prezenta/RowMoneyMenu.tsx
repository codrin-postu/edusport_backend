import * as React from 'react';
import { lessonMenuItems, lessonPayPreselect, payPreselect, rowMenuItems, type RowMenuKey } from '../../../club/prezenta/panel-view';
import type { LessonPanel, PanelRow, SectionKind } from '../../../club/presence/attendance/api-types';
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

/** The lesson panel's row "...": "+ Plată" with the athlete locked and this lesson preselected once it is saved and present (5.5). */
export function LessonMoneyMenu({ lesson }: { lesson: LessonPanel }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <RowMenu name={lesson.athleteName} items={lessonMenuItems()} onPick={() => setOpen(true)} />
      {open && <PaymentWindow mode="new" athlete={{ id: lesson.athleteId, name: lesson.athleteName }} preselect={lessonPayPreselect(lesson)} onClose={() => setOpen(false)} />}
    </>
  );
}
