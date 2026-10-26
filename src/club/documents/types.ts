/** The two generated documents: the Acord (every registration) and the Cerere de adeziune (membership Da). */
export type DocumentKind = 'acord' | 'adeziune';

export const DOCUMENT_KINDS: readonly DocumentKind[] = ['acord', 'adeziune'];

/** A generated PDF on disk, in the private documents folder. */
export interface StoredDocument {
  kind: DocumentKind;
  fileName: string;
  path: string;
}

export function isDocumentKind(value: unknown): value is DocumentKind {
  return value === 'acord' || value === 'adeziune';
}

/** The Sezon values printed on the documents. */
export type DocumentSeason = { label: string; startMonth: string; endMonth: string; membershipFee: number | null };

/** Everything the PDFs print. `null` prints a blank line, filled in by hand on paper. */
export type DocumentValues = {
  registrationNumber: string | null;
  parentName: string | null;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  childName: string | null;
  birthDate: string | null;
  date: string | null;
  season: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  fee: string | null;
};
