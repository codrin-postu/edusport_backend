/**
 * Ends every session of every admin, once (runbook: right after `ADMIN_GATE` goes on). Sessions opened through Strapi's own login while the
 * gate was off are password-only and would otherwise live on without 2FA. Answers how many admins it went through; one failure does not stop the rest.
 */
export async function endEveryAdminSession(
  adminIds: number[],
  end: (adminId: number) => Promise<void>,
  log: (line: string) => void = () => undefined,
): Promise<{ ended: number; failed: number }> {
  let ended = 0;
  let failed = 0;
  for (const id of adminIds) {
    try {
      await end(id);
      ended += 1;
    } catch (err) {
      failed += 1;
      log(`[end-sessions] admin ${id} failed: ${err instanceof Error ? err.name : 'error'}`);
    }
  }
  return { ended, failed };
}
