import { FEATURES_COPY } from './copy';
import { applyChange, FEATURE_KEYS, type FeatureKey, type Features, type FeaturesResponse, type Installed } from './features';

export type FeatureRow = {
  key: FeatureKey;
  name: string;
  text: string;
  on: boolean;
  disabled: boolean;
  reason: 'needsPrezenta' | 'notInstalled' | null;
};

/** The rows of the Funcții page: switch positions come from `saved`; a portal that is not installed shows off. */
export function featureRows(data: FeaturesResponse): FeatureRow[] {
  const { saved, installed } = data;
  return FEATURE_KEYS.map((key) => {
    const item = FEATURES_COPY.items[key];
    let text: string = item.text;
    if (key === 'portalAntrenori' && !saved.prezenta) text = FEATURES_COPY.coachTextWithoutPrezenta;
    let reason: FeatureRow['reason'] = null;
    if (key === 'abonamente' && !saved.prezenta) reason = 'needsPrezenta';
    if ((key === 'portalAntrenori' || key === 'portalParinti') && !installed[key]) reason = 'notInstalled';
    if (reason) text = FEATURES_COPY[reason];
    const on = reason === 'notInstalled' ? false : saved[key];
    return { key, name: item.name, text, on, disabled: reason !== null, reason };
  });
}

/** What the dialog shows when `key` is switched off: title, body, and the names of the features that go off with it. */
export function warningFor(saved: Features, key: FeatureKey, installed: Installed): { title: string; body: string; alsoOff: string[] } {
  const result = applyChange(saved, key, false, installed);
  const alsoOff = result.ok ? result.alsoOff.map((k) => FEATURES_COPY.items[k].name) : [];
  return { title: FEATURES_COPY.warningTitle(key), body: FEATURES_COPY.warning[key], alsoOff };
}

/** The last-change line, or null when nothing was changed yet. */
export function lastChangeLine(last: FeaturesResponse['lastChange']): string | null {
  if (!last) return null;
  const d = new Date(last.at);
  const date = Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
  return FEATURES_COPY.lastChange(last.by, date);
}
