/**
 * Refusal texts of the 3A+3B admin routes. CONFIRM_ERRORS are the spec's (4.7). ADMIN_ERRORS show only when
 * the admin screen's own guards were bypassed (a stale page); their wording waits on plan item N1 (option A).
 */
export const CONFIRM_ERRORS = {
  failed: 'Confirmarea nu a reușit. Nimic nu a fost salvat.',
  taken: 'Înscrierea a fost deja confirmată de alt administrator.',
  birthDate: 'Data nașterii nu poate fi citită. Corectați-o în Date.',
} as const;

export const ADMIN_ERRORS = {
  notFound: 'Nu a fost găsit.',
  stale: 'Datele s-au schimbat. Reîncarcă pagina.',
  nameRequired: 'Completați numele.',
  birthDate: 'Alegeți data nașterii.',
  invalid: 'Cerere invalidă.',
  failed: 'Acțiunea nu a reușit. Nimic nu a fost salvat.',
} as const;
