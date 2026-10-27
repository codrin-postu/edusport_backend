/** Import-free text pieces shared by the P3 history lines and the phase 4 copy; keeps those two from importing each other. */
export const ARROW = '→';

export const quotedChange = (label: string, from: string, to: string): string => `${label}: "${from}" ${ARROW} "${to}"`;
