/** Last calendar day of a `YYYY-MM` month, as `YYYY-MM-DD`. */
export function lastDayOfMonth(month: string): string {
  const day = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, '0')}`;
}
