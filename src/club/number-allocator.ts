import { formatRegistrationNumber, nextRegistrationNumber, parseRegistrationNumber } from './registration-number';

/** Retries after the first attempt when the number is taken (spec 1.2: "up to 5 times"). */
export const MAX_NUMBER_RETRIES = 5;

export class RegistrationNumberClashError extends Error {
  constructor(readonly attempts: number) {
    super(`No free registration number after ${attempts} attempts`);
    this.name = 'RegistrationNumberClashError';
  }
}

export type AllocatorDeps<T> = {
  /** Every registration number already starting with `<startYear>-`, in any season. */
  readNumbers: (startYear: number) => Promise<(string | null)[]>;
  /** Insert the registration with this number; must let the database or Strapi error through on a clash. */
  create: (registrationNumber: string) => Promise<T>;
};

type ErrorLike = {
  code?: unknown;
  constraint?: unknown;
  message?: unknown;
  name?: unknown;
  details?: { errors?: { path?: unknown; message?: unknown }[] };
};

const FIELD = 'registrationNumber';
const COLUMN = 'registration_number';

function isStrapiUniqueError(e: ErrorLike): boolean {
  const errors = Array.isArray(e.details?.errors) ? e.details.errors : [];
  return (
    e.name === 'ValidationError' &&
    errors.some((x) => Array.isArray(x.path) && x.path[0] === FIELD && /unique/i.test(String(x.message)))
  );
}

/** True when `err` says another registration already holds this number. */
export function isRegistrationNumberClash(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as ErrorLike;
  if (e.code === '23505') return String(e.constraint ?? e.message).includes(COLUMN);
  const message = typeof e.message === 'string' ? e.message : '';
  if (message.includes('UNIQUE constraint failed') && message.includes(COLUMN)) return true;
  return isStrapiUniqueError(e);
}

function nextCandidate(numbers: (string | null)[], startYear: number, lastTried: string | null): string {
  const fromRead = nextRegistrationNumber(numbers, startYear);
  const last = parseRegistrationNumber(lastTried);
  if (!last) return fromRead;
  const afterLast = formatRegistrationNumber(startYear, last.seq + 1);
  return afterLast > fromRead ? afterLast : fromRead;
}

/** Create a record under the next free number for `startYear`, retrying on a clash. */
export async function allocateRegistrationNumber<T>(
  startYear: number,
  deps: AllocatorDeps<T>,
  maxRetries = MAX_NUMBER_RETRIES,
): Promise<{ registrationNumber: string; result: T }> {
  let lastTried: string | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const registrationNumber = nextCandidate(await deps.readNumbers(startYear), startYear, lastTried);
    try {
      return { registrationNumber, result: await deps.create(registrationNumber) };
    } catch (err) {
      if (!isRegistrationNumberClash(err)) throw err;
      lastTried = registrationNumber;
    }
  }
  throw new RegistrationNumberClashError(maxRetries + 1);
}
