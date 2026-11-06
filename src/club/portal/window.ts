import { addDays } from '../groups/dates';

export const CORRECTION_DAYS = 7;

export const correctionDeadline = (date: string): string => addDays(date, CORRECTION_DAYS);

export const canCoachCorrect = (date: string, today: string): boolean => today <= correctionDeadline(date);
