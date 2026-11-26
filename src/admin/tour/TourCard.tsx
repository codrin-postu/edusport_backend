import * as React from 'react';
import type { TourStep } from '../../club/onboarding/flows';
import { TOUR_COPY } from '../../club/onboarding/copy';
import type { Placement } from '../../club/onboarding/placement';
import { GHID_URL } from '../dashboard/menu';
import { Button } from '../ui';
import { ProgressRing } from './ProgressRing';

export interface TourCardProps {
  step: TourStep;
  progress: number;
  placement: Placement;
  onNext: () => void;
  onExit: () => void;
  /** The introduction has no example to leave: its exit button says Închide. */
  intro?: boolean;
}

/** The card beside the target (bottom sheet on a phone): where, ring, title, text, action, guide link, exit and next. */
export const TourCard = React.forwardRef<HTMLDivElement, TourCardProps>(function TourCard({ step, progress, placement, onNext, onExit, intro }, ref) {
  const style = placement.sheet ? undefined : { top: placement.top, left: placement.left };
  return (
    <div ref={ref} className={placement.sheet ? 'tour-card tour-card--sheet' : 'tour-card'} style={style} role="dialog" aria-label={step.title}>
      <div className="tour-head">
        <span className="tour-where">{step.where}</span>
        <ProgressRing value={progress} />
      </div>
      <h2 className="tour-title">{step.title}</h2>
      {step.text && <p className="tour-text">{step.text}</p>}
      {step.action && <p className="tour-action">{step.action}</p>}
      {step.guide && (
        <a className="tour-guide" href={`${GHID_URL}/${step.guide}`} target="_blank" rel="noopener noreferrer">
          {TOUR_COPY.more}
        </a>
      )}
      <div className="tour-foot">
        <Button variant="ghost" size="sm" onClick={onExit}>{intro ? TOUR_COPY.close : TOUR_COPY.exit}</Button>
        {!step.waitFor && <Button size="sm" onClick={onNext}>{TOUR_COPY.next}</Button>}
      </div>
    </div>
  );
});
