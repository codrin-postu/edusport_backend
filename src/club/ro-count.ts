/** Romanian "de" after 20, 100, 120, ... but not after 101 to 119 ("20 de sportivi", "101 sportivi"). Pure. */
const needsDe = (n: number): boolean => n >= 20 && (n % 100 === 0 || n % 100 >= 20);

export const countWords = (n: number, one: string, many: string): string => (n === 1 ? `1 ${one}` : `${n} ${needsDe(n) ? 'de ' : ''}${many}`);
