/** Env value helpers. An empty or blank value counts as missing: `??` alone would let `NAME=` through as ''. */
export const envText = (value: string | undefined): string | undefined => {
  const text = (value ?? '').trim();
  return text === '' ? undefined : text;
};

/** A number from an env value, the fallback when the value is missing or not a finite number. */
export const envNumber = (value: string | undefined, fallback: number): number => {
  const text = envText(value);
  const n = text === undefined ? NaN : Number(text);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * `DATABASE_CLIENT` is required: a silent SQLite fallback in production keeps data inside the container and loses it on rebuild.
 * Only `NODE_ENV=development` may leave it out (SQLite file for local work); anything else fails at boot with a clear message.
 */
export function databaseClient(env: NodeJS.ProcessEnv = process.env): string {
  const client = envText(env.DATABASE_CLIENT);
  if (client) return client;
  if (envText(env.NODE_ENV) === 'development') return 'sqlite';
  throw new Error('DATABASE_CLIENT is not set. Set it to postgres (see .env.example); only NODE_ENV=development falls back to sqlite.');
}
