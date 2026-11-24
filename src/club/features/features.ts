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
/** Every switch on: what background work and fixtures use when no request decides. */
export const ALL_ON: Features = { prezenta: true, abonamente: true, portalAntrenori: true, portalParinti: true, parcurs: true };
export type Installed = { portalAntrenori: boolean; portalParinti: boolean };

export type ChangeResult =
  | { ok: true; next: Features; alsoOff: FeatureKey[] }
  | { ok: false; code: 'needsPrezenta' | 'notInstalled' };

/** The e-mail job kinds a switch can cancel; which feature one job belongs to is decided by `jobFeature`. */
export const FEATURE_JOB_KINDS: readonly string[] = ['payment', 'portal-invite', 'portal-access'];

/**
 * The feature a queued e-mail job depends on, decided from the job itself: a payment mail by `abonamente`; an invite by the portal
 * host in its payload (a `sportiv.` host is the parent portal, anything else the coach portal); an access mail by its variant
 * (`coach` is the coach portal, `child` the parent portal). Other kinds depend on no switch.
 */
export function jobFeature(job: { kind?: string | null; payload?: unknown }): FeatureKey | null {
  const payload = isRecord(job.payload) ? job.payload : {};
  if (job.kind === 'payment') return 'abonamente';
  if (job.kind === 'portal-invite') return typeof payload.host === 'string' && payload.host.startsWith('sportiv.') ? 'portalParinti' : 'portalAntrenori';
  if (job.kind === 'portal-access') return payload.variant === 'coach' ? 'portalAntrenori' : 'portalParinti';
  return null;
}

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

/** The portal switch a session host answers to (`antrenor` -> `portalAntrenori`, `sportiv` -> `portalParinti`); null for any other value. */
export function hostFeature(host: string): 'portalAntrenori' | 'portalParinti' | null {
  if (host === 'antrenor') return 'portalAntrenori';
  if (host === 'sportiv') return 'portalParinti';
  return null;
}

/** What a portal `me` answer tells the app about the three switches that change its pages. */
export type PortalFeatures = { prezenta: boolean; abonamente: boolean; parcurs: boolean };

export const portalFeatures = (f: Features): PortalFeatures => ({ prezenta: f.prezenta, abonamente: f.abonamente, parcurs: f.parcurs });

/** The answer of `GET /club/features` (`data`): `features` is the effective set the admin gates on. */
export type FeaturesResponse = {
  saved: Features;
  features: Features;
  installed: Installed;
  lastChange: { by: string; at: string } | null;
};
