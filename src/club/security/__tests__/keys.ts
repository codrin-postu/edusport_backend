import { loadKeys, type Keys } from '../keys';

/** Fixed keys for tests only; never real values. */
export const TEST_ENV: NodeJS.ProcessEnv = {
  AUTH_SECRET_KEY: Buffer.alloc(32, 0x11).toString('base64'),
  AUTH_CODE_KEY: Buffer.alloc(32, 0x22).toString('base64'),
};

export const OTHER_ENV: NodeJS.ProcessEnv = {
  AUTH_SECRET_KEY: Buffer.alloc(32, 0x33).toString('base64'),
  AUTH_CODE_KEY: Buffer.alloc(32, 0x44).toString('base64'),
};

export const TEST_KEYS = loadKeys(TEST_ENV) as Keys;
export const OTHER_KEYS = loadKeys(OTHER_ENV) as Keys;

/** TEST_KEYS after a rotation: the test keys become the old ones, new keys are current. */
export const ROTATED_KEYS = loadKeys({
  AUTH_SECRET_KEY: OTHER_ENV.AUTH_SECRET_KEY,
  AUTH_CODE_KEY: OTHER_ENV.AUTH_CODE_KEY,
  AUTH_SECRET_KEY_OLD: TEST_ENV.AUTH_SECRET_KEY,
  AUTH_CODE_KEY_OLD: TEST_ENV.AUTH_CODE_KEY,
}) as Keys;
