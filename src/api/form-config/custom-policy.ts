import type { FormType } from './registry';

/** Forms that never take admin-added questions. The registration form mirrors the club's script form (user decision, 2026-10-03). */
export const FORMS_WITHOUT_CUSTOM_QUESTIONS: ReadonlySet<FormType> = new Set<FormType>(['inscriere']);

/** The overlay as the public form sees it: custom questions removed for the forms above. */
export function withoutCustomQuestions<T extends { custom?: unknown }>(type: FormType, overlay: T): T {
  if (!FORMS_WITHOUT_CUSTOM_QUESTIONS.has(type)) return overlay;
  const next = { ...overlay };
  delete next.custom;
  return next;
}
