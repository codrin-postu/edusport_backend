import * as React from 'react';
import { AdminPage, Window, PageHeader, Button, Loading } from '../ui';
import { useAreas } from '../lib/useAreas';
import { useFeatures } from '../lib/useFeatures';
import { DASHBOARD_TO } from '../dashboard/menu';
import { TOUR_COPY } from '../../club/onboarding/copy';
import { flowsFor } from '../../club/onboarding/flows';
import { ProgressRing } from '../tour/ProgressRing';
import { startTour, useTourProgress } from '../tour/progressStore';

/** Primii pași (/primii-pasi): the role's flows with progress; starting goes through the tour-start event. */
const PrimiiPasiPage: React.FC = () => {
  const { has } = useAreas();
  const features = useFeatures();
  const { ready, progress } = useTourProgress();
  const flows = flowsFor(has, features.on);
  const done = flows.filter((f) => progress.flows[f.id]).length;

  return (
    <AdminPage>
      <Window>
        <PageHeader
          back={{ to: DASHBOARD_TO }}
          title={TOUR_COPY.header}
          subtitle={TOUR_COPY.subtitle}
          actions={<Button variant="secondary" onClick={() => startTour()}>{TOUR_COPY.replay}</Button>}
        />
        {!ready ? <Loading /> : (
          <div className="ui-body">
            <div className="tour-pp-big">
              <ProgressRing value={flows.length ? done / flows.length : 0} size={56} stroke={6} />
              <span>{TOUR_COPY.count(done, flows.length)}</span>
            </div>
            <div className="tour-pp-list">
              {flows.map((f) => (
                <div key={f.id} className="tour-pp-row">
                  <span>{f.name}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ui-space-3)' }}>
                    {progress.flows[f.id] && <span className="ui-muted">{TOUR_COPY.doneLabel}</span>}
                    <Button size="sm" variant={progress.flows[f.id] ? 'secondary' : 'primary'} onClick={() => startTour(f.id)}>
                      {progress.flows[f.id] ? TOUR_COPY.again : TOUR_COPY.start}
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Window>
    </AdminPage>
  );
};

export default PrimiiPasiPage;
