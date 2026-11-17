/** Equals the PNG basename, e.g. `antrenamente-25`, `saritura-2lz`, `prietenie-07`. */
export type PinId = string;
export type JumpCode = 's' | 't' | 'lo' | 'f' | 'lz' | 'a';
export type JumpLevel = 1 | 2 | 3;

/** One pin as the portals show it. Dates are ISO `YYYY-MM-DD`; formatting happens in the UI. */
export type PinView = { pin: PinId; label: string; earnedOn: string | null; count: number };

export type ReceivedPin = { id: string; design: number; message: string; from: string; givenOn: string };

/** What the athlete sees: pins by group, the friendship pins received and how many can still be given today. */
export type Parcurs = {
  antrenamente: PinView[]; concursuri: PinView[]; membru: PinView[]; insigne: PinView[];
  sarituri: PinView[][]; received: ReceivedPin[]; pinsLeft: number;
};

/** Coach and admin: the same with who gave each award and the friendship pins the athlete gave; every name is the full one. */
export type ParcursStaff = Parcurs & {
  awards: { id: string; pin: PinId; givenOn: string; givenBy: string }[];
  given: (ReceivedPin & { to: string })[];
};
