import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { AdminPage, Loading } from '../ui';
import { SPORTIVI_PATH, athleteRecordTo, oldEditorProfileId } from '../../club/sportivi/routes';

/**
 * The old profile editor's address (gaps #42). `?id=<public profile>` (Competiții rows, old
 * bookmarks) opens that athlete's record; anything else opens the Sportivi list.
 */
export default function SportivEditPage() {
  const { get } = useFetchClient();
  const navigate = useNavigate();
  const { search } = useLocation();
  const started = React.useRef(false);
  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    const go = (to: string) => navigate(to, { replace: true });
    const profileId = oldEditorProfileId(search);
    if (!profileId) return go(SPORTIVI_PATH);
    get<{ data?: { documentId?: unknown } }>(`/api/club/athletes/by-profile/${encodeURIComponent(profileId)}`)
      .then((r) => {
        const id = r?.data?.data?.documentId;
        go(typeof id === 'string' ? athleteRecordTo(id) : SPORTIVI_PATH);
      })
      .catch(() => go(SPORTIVI_PATH));
  }, [get, navigate, search]);
  return (
    <AdminPage>
      <Loading />
    </AdminPage>
  );
}
