/**
 * Refusal texts of the 3A+3B admin routes. CONFIRM_ERRORS are the spec's (4.7). ADMIN_ERRORS show only when
 * the admin screen's own guards were bypassed (a stale page); their wording waits on plan item N1 (option A).
 */
export const CONFIRM_ERRORS = {
  failed: 'Confirmarea a eșuat.',
  taken: 'Înscrierea a fost deja confirmată de alt administrator.',
  birthDate: 'Corectează data nașterii în Date.',
} as const;

export const ADMIN_ERRORS = {
  notFound: 'Nu a fost găsit.',
  stale: 'Datele s-au schimbat. Reîncarcă.',
  nameRequired: 'Completați numele.',
  birthDate: 'Alegeți data nașterii.',
  invalid: 'Cerere invalidă.',
  failed: 'Nu s-a salvat nimic.',
} as const;
