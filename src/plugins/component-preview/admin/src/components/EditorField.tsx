import * as React from 'react';
import { Field } from '@strapi/design-system';

interface EditorFieldProps {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

/**
 * Wraps Field.Root / Label / Hint / Error for proper a11y on every input.
 * Field.Root holds the id in context - Field.Label renders <label for={id}>,
 * and TextInput/Textarea forward that id to the native element automatically.
 */
export function EditorField({ name, label, hint, error, required, children }: EditorFieldProps) {
  return (
    <Field.Root name={name} id={name} hint={hint} error={error} required={required} width="100%">
      <Field.Label>{label}</Field.Label>
      {children}
      <Field.Hint />
      <Field.Error />
    </Field.Root>
  );
}
