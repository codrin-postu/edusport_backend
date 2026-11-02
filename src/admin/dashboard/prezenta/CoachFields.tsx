import * as React from 'react';
import { Field, SearchableSelect } from '../../ui';
import { PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import type { PrezentaApi } from './api';
import { addCoachField, setCoach, type CoachFields as CoachValue } from '../../../club/prezenta/panel-view';

export type CoachOptions = { coaches: { documentId: string; name: string }[]; failed: boolean };

/** The coach choices; `failed` is set when they could not be loaded, so the panel can say so instead of showing an empty list. */
export function useCoachOptions(api: PrezentaApi): CoachOptions {
  const [state, setState] = React.useState<CoachOptions>({ coaches: [], failed: false });
  React.useEffect(() => {
    let off = false;
    api.options()
      .then((o) => { if (!off) setState({ coaches: o.coaches, failed: false }); })
      .catch(() => { if (!off) setState({ coaches: [], failed: true }); });
    return () => { off = true; };
  }, [api]);
  return state;
}

type Props = {
  label: string;
  value: CoachValue;
  options: { documentId: string; name: string }[];
  disabled?: boolean;
  error?: string | null;
  onChange: (next: CoachValue) => void;
};

/** "Antrenor" (4.2): one field per coach (Membri echipă); a coach shows in one field only; clearing an extra field removes it (decided 7). */
export function CoachFields({ label, value, options, disabled, error, onChange }: Props) {
  const optionsFor = (index: number) =>
    options.filter((o) => o.documentId === value[index] || !value.includes(o.documentId)).map((o) => ({ value: o.documentId, label: o.name }));
  return (
    <div className="pz-coaches">
      {value.map((id, i) => (
        <Field key={`coach-${i}`} label={label} hideLabel={i > 0} error={i === 0 ? error : null}>
          <SearchableSelect value={id} options={optionsFor(i)} disabled={disabled} onChange={(v) => onChange(setCoach(value, i, v))} />
        </Field>
      ))}
      {!disabled && value.every(Boolean) && (
        <button type="button" className="pz-link" onClick={() => onChange(addCoachField(value))}>{PREZENTA_COPY.addCoaches}</button>
      )}
    </div>
  );
}
