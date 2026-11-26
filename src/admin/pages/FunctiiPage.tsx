import * as React from 'react';
import { getFetchClient } from '@strapi/admin/strapi-admin';
import { AdminPage, Window, PageHeader, Notice, Loading, EditorCard, Switch, Field, Modal, Button, adminToast } from '../ui';
import { useFeatures, refreshFeatures } from '../lib/useFeatures';
import { DASHBOARD_TO } from '../dashboard/menu';
import { FEATURES_COPY } from '../../club/features/copy';
import type { FeatureKey } from '../../club/features/features';
import { featureRows, lastChangeLine, warningFor } from '../../club/features/page-view';

/** Funcții (/plugins/edusport-functii): the five club-wide switches, Super Admin only. Logic in club/features/page-view.ts. */
const FunctiiPage: React.FC = () => {
  const { ready, data } = useFeatures();
  const [asking, setAsking] = React.useState<FeatureKey | null>(null);
  const [busy, setBusy] = React.useState(false);

  const save = async (key: FeatureKey, on: boolean) => {
    setBusy(true);
    try {
      await getFetchClient().put('/api/club/features', { key, on });
      await refreshFeatures();
    } catch {
      adminToast.error('Nu am putut salva. Încearcă din nou.');
    } finally {
      setBusy(false);
      setAsking(null);
    }
  };

  const warning = data && asking ? warningFor(data.saved, asking, data.installed) : null;
  const last = data ? lastChangeLine(data.lastChange) : null;

  return (
    <AdminPage>
      <Window>
        <PageHeader back={{ to: DASHBOARD_TO }} title={FEATURES_COPY.page} />
        {!ready && <Loading />}
        {ready && !data && (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca datele.</Notice>
          </div>
        )}
        {data && (
          <div className="ui-body">
            <EditorCard title={FEATURES_COPY.card} tour="fu-lista">
              <p className="ui-muted">{FEATURES_COPY.intro}</p>
              {featureRows(data).map((row) => (
                <Field key={row.key} label={row.name}>
                  <div data-tour={row.key === 'parcurs' ? 'fu-parcurs' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 'var(--ui-space-3)' }}>
                    <Switch
                      checked={row.on}
                      disabled={row.disabled || busy}
                      aria-label={row.name}
                      onChange={(next) => (next ? void save(row.key, true) : setAsking(row.key))}
                    />
                    <span className="ui-muted">{row.text}</span>
                  </div>
                </Field>
              ))}
              <p className="ui-muted">{FEATURES_COPY.footer}</p>
              {last && <p className="ui-muted">{last}</p>}
            </EditorCard>
          </div>
        )}
      </Window>
      <Modal
        open={warning !== null}
        onClose={() => !busy && setAsking(null)}
        title={warning?.title ?? ''}
        role="alertdialog"
        footer={
          <>
            <Button variant="ghost" disabled={busy} onClick={() => setAsking(null)}>{FEATURES_COPY.cancel}</Button>
            <Button variant="danger" loading={busy} onClick={() => asking && void save(asking, false)}>{FEATURES_COPY.confirm}</Button>
          </>
        }
      >
        {warning && (
          <>
            <p>{warning.body}</p>
            {warning.alsoOff.length > 0 && (
              <>
                <p>{FEATURES_COPY.alsoOffLine}</p>
                <ul>
                  {warning.alsoOff.map((name) => <li key={name}>{name}</li>)}
                </ul>
              </>
            )}
          </>
        )}
      </Modal>
    </AdminPage>
  );
};

export default FunctiiPage;
