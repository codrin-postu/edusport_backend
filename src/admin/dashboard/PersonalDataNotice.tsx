import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Notice, adminToast } from '../ui';
import { ADMIN_ERRORS } from '../../club/athletes/errors';
import { PERSONAL_DATA_COPY } from '../../club/personal-data/copy';
import type { InactiveSummary } from '../../club/personal-data/settings';
import { inactiveListTo } from '../../club/sportivi/routes';
import { useSportiviApi, type SportiviApi } from './sportivi/api';
import { useIsSuperAdmin } from './sportivi/useSuperAdmin';

function useInactiveSummary(api: SportiviApi) {
  const [summary, setSummary] = React.useState<InactiveSummary | null>(null);
  React.useEffect(() => {
    let off = false;
    api.inactiveSummary().then((s) => {
      if (!off) setSummary(s);
    }).catch(() => undefined);
    return () => {
      off = true;
    };
  }, [api]);
  return { summary, setSummary };
}

/** Dashboard notice (3C spec 5): while athletes are past the retention period and the review is not hidden this season. It only informs. */
export function PersonalDataNotice() {
  const api = useSportiviApi();
  const superAdmin = useIsSuperAdmin();
  const navigate = useNavigate();
  const { summary, setSummary } = useInactiveSummary(api);
  const [busy, setBusy] = React.useState(false);
  if (!summary?.shown) return null;
  const hide = async () => {
    setBusy(true);
    try {
      setSummary(await api.hideInactiveReview());
    } catch {
      adminToast.error(ADMIN_ERRORS.failed);
    } finally {
      setBusy(false);
    }
  };
  const actions = (
    <>
      <Button size="sm" variant="secondary" onClick={() => navigate(inactiveListTo)}>{PERSONAL_DATA_COPY.noticeLink}</Button>
      {superAdmin && <Button size="sm" variant="ghost" loading={busy} onClick={() => void hide()}>{PERSONAL_DATA_COPY.noticeHide}</Button>}
    </>
  );
  return <Notice tone="info" action={actions}>{PERSONAL_DATA_COPY.notice(summary.count, summary.retentionYears)}</Notice>;
}
