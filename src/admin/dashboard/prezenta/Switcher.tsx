import * as React from 'react';
import { createPortal } from 'react-dom';

type Props = {
  label: string;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  /** The middle segment: a button when `onMiddle` is set, otherwise a plain label. */
  middle: React.ReactNode;
  onMiddle?: () => void;
  middleDisabled?: boolean;
  middleOn?: boolean;
  nextDisabled?: boolean;
};

/** One segmented switcher: "<" middle ">" (the approved mockup's day and month switcher). */
export function Switcher({ label, prevLabel, nextLabel, onPrev, onNext, middle, onMiddle, middleDisabled, middleOn, nextDisabled }: Props) {
  const mid = `pz-seg-btn${middleOn ? ' pz-seg-btn--on' : ''}`;
  return (
    <span className="pz-seg" role="group" aria-label={label}>
      <button type="button" className="pz-seg-btn" aria-label={prevLabel} onClick={onPrev}>{'<'}</button>
      {onMiddle ? (
        <button type="button" className={mid} disabled={middleDisabled} onClick={onMiddle}>{middle}</button>
      ) : (
        <span className={`${mid} pz-seg-label`}>{middle}</span>
      )}
      <button type="button" className="pz-seg-btn" aria-label={nextLabel} disabled={nextDisabled} onClick={onNext}>{'>'}</button>
    </span>
  );
}

/**
 * Where a tab puts its switcher and button. `host` is the page header's actions
 * slot: undefined means no header slot (the group page tab), which gets a bar of
 * its own; null means the slot is not mounted yet.
 */
export function HeaderSlot({ host, children }: { host?: HTMLElement | null; children: React.ReactNode }) {
  if (host === undefined) return <div className="pz-bar">{children}</div>;
  return host ? createPortal(children, host) : null;
}
