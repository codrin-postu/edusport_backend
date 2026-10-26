import * as React from 'react';
import { Button, adminToast } from '../../ui';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { requestErrorText } from '../../../club/registration-panel';
import { RECORD_COPY } from '../../../club/sportivi/record-view';
import type { SportiviApi } from './api';
import { ProfileEditor } from './ProfileEditor';

type Props = { record: AthleteRecord; api: SportiviApi; onRecord: (record: AthleteRecord) => void; active: boolean };

/** Profil public (spec 6.3): today's whole profile editor, or "Creează profil public" (page off, 3b Q3). */
export function ProfileTab({ record, api, onRecord, active }: Props) {
  const [busy, setBusy] = React.useState(false);
  const create = async () => {
    setBusy(true);
    try {
      onRecord(await api.createProfile(record.documentId));
    } catch (err) {
      adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="ui-body">
        <p className="ui-hint">{RECORD_COPY.profile.note}</p>
        {!record.profile && (
          <div>
            <Button onClick={() => void create()} loading={busy}>{RECORD_COPY.profile.create}</Button>
          </div>
        )}
      </div>
      {record.profile && (
        <ProfileEditor
          key={record.profile.documentId}
          profileId={record.profile.documentId}
          athleteId={record.documentId}
          athleteName={record.fields.name ?? ''}
          api={api}
          onRecord={onRecord}
          active={active}
        />
      )}
    </>
  );
}
