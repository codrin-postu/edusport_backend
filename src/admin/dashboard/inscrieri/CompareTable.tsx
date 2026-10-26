import * as React from 'react';
import { Checkbox } from '../../ui';
import type { AthleteField } from '../../../club/athlete-data';
import type { ComparisonRow } from '../../../club/confirm/compare';
import { CONFIRM_COPY, MATCH_COPY } from '../../../club/inscrieri-copy';

export type CompareTicks = { selected: AthleteField[]; onTick: (field: AthleteField, on: boolean) => void };

/**
 * "În fișă" / "În înscriere" (spec 3.3, 4.2): differences on a light background only, empty cells blank.
 * With `ticks` (the confirm window) each differing row gets an "Actualizează" tick.
 */
export function CompareTable({ rows, ticks }: { rows: ComparisonRow[]; ticks?: CompareTicks }) {
  return (
    <div className="ins-cmp-wrap">
      <table className="ins-cmp">
        <thead>
          <tr>
            <th aria-hidden="true" />
            <th>{MATCH_COPY.inRecord}</th>
            <th>{MATCH_COPY.inRegistration}</th>
            {ticks && <th aria-hidden="true" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.field} className={r.differs ? 'is-diff' : undefined}>
              <td>{r.label}</td>
              <td>{r.athlete}</td>
              <td>{r.registration}</td>
              {ticks && (
                <td>
                  {r.differs && (
                    <Checkbox checked={ticks.selected.includes(r.field)} onChange={(on) => ticks.onTick(r.field, on)} label={CONFIRM_COPY.update} />
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
