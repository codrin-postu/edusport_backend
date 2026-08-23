import * as React from 'react';
import { Combobox, ComboboxOption } from '@strapi/design-system';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
  creatable?: boolean | 'visible';
  onCreateOption?: (value: string) => void;
  createMessage?: (value: string) => string;
  noOptionsMessage?: (value: string) => string;
}

/**
 * Searchable single-select backed by Strapi's Combobox.
 *
 * The Combobox primitive keeps `value` (selected option ID) and `textValue`
 * (text shown in the input) as independent state. This wrapper derives the
 * correct display label from the options list and keeps them in sync so the
 * user always sees the option's human-readable label, never a raw ID.
 */
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Caută...',
  disabled,
  'aria-label': ariaLabel,
  creatable,
  onCreateOption,
  createMessage = (v) => `Adaugă „${v}"`,
  noOptionsMessage = () => 'Niciun rezultat',
}: Props) {
  // Derive the display label for the currently selected value
  const labelFor = React.useCallback(
    (v: string) => options.find((o) => o.value === v)?.label ?? '',
    [options],
  );

  const [textValue, setTextValue] = React.useState(() => labelFor(value));

  // Keep textValue in sync when the selected value or available options change
  // (e.g. on initial load when options arrive after mount, or on external reset)
  const prevValueRef = React.useRef(value);
  React.useEffect(() => {
    const label = labelFor(value);
    // Only override what the user typed if the controlled value itself changed
    // or if we can now resolve a label we couldn't before (options just loaded)
    if (value !== prevValueRef.current || (value && label && textValue !== label)) {
      prevValueRef.current = value;
      setTextValue(label);
    }
  }, [value, labelFor]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the dropdown closes without a selection, revert typed text back to
  // the current selection's label so stray search terms don't persist
  const handleOpenChange = (open: boolean) => {
    if (!open) setTextValue(labelFor(value));
  };

  return (
    <Combobox
      value={value || ''}
      textValue={textValue}
      onTextValueChange={setTextValue}
      onOpenChange={handleOpenChange}
      onChange={(val: string) => onChange(val)}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      creatable={creatable}
      onCreateOption={onCreateOption}
      createMessage={createMessage}
      noOptionsMessage={noOptionsMessage}
    >
      {options.map((opt) => (
        <ComboboxOption key={opt.value} value={opt.value}>
          {opt.label}
        </ComboboxOption>
      ))}
    </Combobox>
  );
}
