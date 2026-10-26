import { expect, it } from 'vitest';
import { captureMessage } from '../../sentry';

it('is inert without SENTRY_DSN', () => {
  expect(() => captureMessage('[email-job] test')).not.toThrow();
});
