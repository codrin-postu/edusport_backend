import { withPeriod } from './core';

/** Parent e-mail on a schedule change, approved texts (spec 6.5). `<zi>` lower case, `<data>` "14 noiembrie", `<ora>` "10:00". */
export const EMAIL_COPY = {
  greeting: 'Bună ziua,',
  signature: 'Echipa EduSport',
  subjectCancel: (group: string, day: string, date: string) => `${group}: ședința de ${day}, ${date}, se anulează`,
  subjectMove: (group: string, day: string, date: string) => `${group}: ședința de ${day}, ${date}, se mută`,
  cancelled: (group: string, day: string, date: string, time: string) => `Ședința grupei ${group} de ${day}, ${date}, ora ${time}, se anulează.`,
  moved: (group: string, day: string, date: string, time: string, newDay: string, newDate: string, newTime: string) =>
    `Ședința grupei ${group} de ${day}, ${date}, ora ${time}, se mută ${newDay}, ${newDate}, ora ${newTime}.`,
  reason: (reason: string) => `Motiv: ${withPeriod(reason)}`,
  next: (day: string, date: string, time: string) => `Următoarea ședință: ${day}, ${date}, ora ${time}.`,
} as const;
