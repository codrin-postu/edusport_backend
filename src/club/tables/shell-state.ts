/** Browser storage key of the saved-tables rail (open or closed); per browser. */
export const RAIL_KEY = 'tabele-rail';

/** Widest screen where the rail is a slide-over instead of a column. */
export const RAIL_OVERLAY_MAX = 900;

/** Whether the rail starts open: the remembered choice ('0' closed, '1' open), else closed up to 900px wide and open above. */
export function railInitial(stored: string | null, viewportWidth: number): boolean {
  if (stored === '0') return false;
  if (stored === '1') return true;
  return viewportWidth > RAIL_OVERLAY_MAX;
}

export function railStored(open: boolean): '0' | '1' {
  return open ? '1' : '0';
}

/** Title of the page: the open view's name, else the label of the type of table. */
export function pageTitle(view: { name: string } | null, subjectLabel: string): string {
  return view ? view.name : subjectLabel;
}

/** The download formats, the first one is what the primary button gives. */
export const EXPORT_FORMATS = [
  { format: 'xlsx', label: 'Excel' },
  { format: 'csv', label: 'CSV' },
] as const;
