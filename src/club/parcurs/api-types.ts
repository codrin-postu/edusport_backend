/** Equals the PNG basename, e.g. `antrenamente-25`, `saritura-2lz`, `prietenie-07`. */
export type PinId = string;
export type JumpCode = 's' | 't' | 'lo' | 'f' | 'lz' | 'a';
export type JumpLevel = 1 | 2 | 3;

/** One pin as the portals show it. Dates are ISO `YYYY-MM-DD`; formatting happens in the UI. */
export type PinView = { pin: PinId; label: string; earnedOn: string | null; count: number };
