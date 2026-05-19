import * as React from 'react';
import {
  Button,
  Field,
  Flex,
  Modal,
  TextInput,
} from '@strapi/design-system';

export interface LinkValue {
  text: string;
  url: string;
}

interface LinkPickerProps {
  open: boolean;
  initialText?: string;
  initialUrl?: string;
  onClose: () => void;
  onSubmit: (link: LinkValue) => void;
}

const SAFE_URL = /^(https?:\/\/|\/|mailto:|tel:)/i;

// In-app replacement for `window.prompt` - collects the link text and URL
// in a Strapi Modal so authors stay inside the admin styling and can paste/edit
// without the browser's native prompt UI.
export function LinkPicker({ open, initialText = '', initialUrl = '', onClose, onSubmit }: LinkPickerProps) {
  const [text, setText] = React.useState(initialText);
  const [url, setUrl] = React.useState(initialUrl);
  const [touched, setTouched] = React.useState(false);

  // Reset form whenever the modal re-opens with fresh initial values.
  React.useEffect(() => {
    if (open) {
      setText(initialText);
      setUrl(initialUrl);
      setTouched(false);
    }
  }, [open, initialText, initialUrl]);

  const trimmedText = text.trim();
  const trimmedUrl = url.trim();
  const urlError = !trimmedUrl
    ? 'URL obligatoriu'
    : !SAFE_URL.test(trimmedUrl)
      ? 'URL trebuie să înceapă cu http://, https://, /, mailto: sau tel:'
      : null;
  const canSubmit = !urlError;

  const submit = () => {
    setTouched(true);
    if (!canSubmit) return;
    onSubmit({ text: trimmedText || trimmedUrl, url: trimmedUrl });
    onClose();
  };

  return (
    <Modal.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Modal.Content style={{ maxWidth: 520 }}>
        <Modal.Header>
          <Modal.Title>Inserează link</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" gap={4} alignItems="stretch">
            <Field.Root id="link-picker-text" name="text" hint="Textul afișat pentru link.">
              <Field.Label>Text</Field.Label>
              <TextInput
                id="link-picker-text"
                value={text}
                placeholder="ex: vezi calendarul"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') submit();
                }}
              />
              <Field.Hint />
            </Field.Root>
            <Field.Root
              id="link-picker-url"
              name="url"
              required
              error={touched && urlError ? urlError : undefined}
            >
              <Field.Label>URL</Field.Label>
              <TextInput
                id="link-picker-url"
                value={url}
                placeholder="https://..."
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') submit();
                }}
              />
              <Field.Error />
            </Field.Root>
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Anulează</Button>
          </Modal.Close>
          <Button onClick={submit} disabled={!canSubmit && touched}>
            Inserează
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}
