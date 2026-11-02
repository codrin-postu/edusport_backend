import * as React from 'react';
import { ConfirmDialog } from '../../ConfirmDialog';
import { cancelText } from '../../../club/bani/payment-window';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { PAYMENT_COPY } from '../../../club/presence/copy/payments';
import type { PaymentRowView } from '../../../club/presence/money-api';
import { requestErrorText } from '../../../club/registration-panel';
import { useMoneyApi } from './api';
import { moneyUndoToast } from './undo';
import { useSubmitOnce } from './useSubmitOnce';

type Props = { payment: PaymentRowView; onClose: () => void };

/** "Anulează plata" (5.10): the row stays, marked anulată; the toast carries "Anulează". */
export function CancelPaymentDialog({ payment, onClose }: Props) {
  const api = useMoneyApi();
  const [error, setError] = React.useState<string | null>(null);
  const submit = useSubmitOnce(async () => {
    setError(null);
    try {
      const { undo } = await api.cancelPayment(payment.paymentId);
      moneyUndoToast(PAYMENT_COPY.cancelled, undo?.actionId ?? null, api);
      onClose();
    } catch (err) {
      setError(requestErrorText(err, PRESENCE_ERRORS.failed));
    }
  });
  return (
    <ConfirmDialog
      open title={PAYMENT_COPY.cancelAction} message={cancelText(payment)} confirmLabel={PAYMENT_COPY.cancelAction} busyLabel={PAYMENT_COPY.cancelAction}
      cancelLabel={PAYMENT_COPY.cancel} busy={submit.busy} error={error} onCancel={onClose} onConfirm={() => void submit.run()}
    />
  );
}
