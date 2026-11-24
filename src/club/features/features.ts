export type FeatureKey =
  | 'prezenta'
  | 'abonamente'
  | 'portalAntrenori'
  | 'portalParinti'
  | 'parcurs';

export const FEATURE_KEYS: readonly FeatureKey[] = [
  'prezenta',
  'abonamente',
  'portalAntrenori',
  'portalParinti',
  'parcurs',
];

export type Features = Record<FeatureKey, boolean>;
export type Installed = { portalAntrenori: boolean; portalParinti: boolean };

export type ChangeResult =
  | { ok: true; next: Features; alsoOff: FeatureKey[] }
  | { ok: false; code: 'needsPrezenta' | 'notInstalled' };

export const JOB_FEATURE: Record<
  'payment' | 'portal-invite' | 'portal-access',
  FeatureKey
> = {
  payment: 'abonamente',
  'portal-invite': 'portalAntrenori',
  'portal-access': 'portalParinti',
};

export function installedPortals(hosts: readonly string[]): Installed {
  return {
    portalAntrenori: hosts.includes('antrenor'),
    portalParinti: hosts.includes('sportiv'),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function savedFeatures(raw: unknown): Features {
  const saved = isRecord(raw) && isRecord(raw.features) ? raw.features : {};
  const out = {} as Features;
  for (const key of FEATURE_KEYS) {
    out[key] = typeof saved[key] === 'boolean' ? (saved[key] as boolean) : true;
  }
  if (!out.prezenta) out.abonamente = false;
  return out;
}

export function readFeatures(raw: unknown, installed: Installed): Features {
  const saved = savedFeatures(raw);
  return {
    ...saved,
    portalAntrenori: saved.portalAntrenori && installed.portalAntrenori,
    portalParinti: saved.portalParinti && installed.portalParinti,
  };
}

export function applyChange(
  saved: Features,
  key: FeatureKey,
  on: boolean,
  installed: Installed,
): ChangeResult {
  if (on && key === 'abonamente' && !saved.prezenta) {
    return { ok: false, code: 'needsPrezenta' };
  }
  if (on && (key === 'portalAntrenori' || key === 'portalParinti') && !installed[key]) {
    return { ok: false, code: 'notInstalled' };
  }
  const next: Features = { ...saved, [key]: on };
  const alsoOff: FeatureKey[] = [];
  if (key === 'prezenta' && !on && saved.abonamente) {
    next.abonamente = false;
    alsoOff.push('abonamente');
  }
  return { ok: true, next, alsoOff };
}

/** The 403 body of a disabled admin feature, in Strapi's error shape (the admin fetch client reads `details.code`). */
export function featureOffBody(feature: FeatureKey): { data: null; error: { status: 403; name: 'ForbiddenError'; message: string; details: { code: 'featureOff'; feature: FeatureKey } } } {
  return { data: null, error: { status: 403, name: 'ForbiddenError', message: 'Feature is off', details: { code: 'featureOff', feature } } };
}
