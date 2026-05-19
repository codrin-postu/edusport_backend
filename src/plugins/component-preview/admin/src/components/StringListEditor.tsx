import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box } from '@strapi/design-system';
import { EditorCard } from './EditorCard';
import { InlineStringList } from './InlineStringList';
import { useMatchMedia } from '../utils/useMatchMedia';

interface StringListEditorProps {
  /** Strapi field name (passed via custom field props). */
  name: string;
  /** Card title. */
  title: string;
  /** Optional sub-line under the title. */
  description?: string;
  /** Label for the "+ add" button. */
  addLabel: string;
  /** Placeholder for empty rows. */
  itemPlaceholder?: string;
  /** Copy shown when the list is empty. */
  emptyLabel?: string;
  /** Number of rows on each <textarea>. */
  rows?: number;
}

/**
 * Whole-card editor for `string[]` Strapi custom fields. Composes {@link InlineStringList}
 * inside an {@link EditorCard} and wires the value through `useField`.
 */
export function StringListEditor({
  name,
  title,
  description,
  addLabel,
  itemPlaceholder,
  emptyLabel,
  rows = 2,
}: StringListEditorProps) {
  const field = useField(name);
  const isMobile = useMatchMedia('(max-width: 640px)');

  const [items, setItems] = React.useState<string[]>(() =>
    Array.isArray(field.value) ? (field.value as string[]) : [],
  );

  React.useEffect(() => {
    if (Array.isArray(field.value)) setItems(field.value as string[]);
  }, [field.value]);

  const handleChange = (next: string[]) => {
    setItems(next);
    field.onChange(name, next);
  };

  return (
    <Box width="100%">
      <EditorCard title={title} description={description}>
        <Box padding={isMobile ? 2 : 4}>
          <InlineStringList
            items={items}
            onChange={handleChange}
            idPrefix={name}
            ariaItemLabel={title}
            addLabel={addLabel}
            itemPlaceholder={itemPlaceholder}
            emptyLabel={emptyLabel}
            rows={rows}
          />
        </Box>
      </EditorCard>
    </Box>
  );
}
