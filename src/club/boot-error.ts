/** What a boot log line says about a failure: the database code and the message when there are any. */
export function bootErrorText(e: unknown): string {
  if (!(e instanceof Error)) return 'unknown';
  const code = (e as { code?: unknown }).code;
  return [typeof code === 'string' ? code : '', e.message].filter(Boolean).join(' ');
}
