import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import {
  Box,
  Divider,
  Field,
  Grid,
  SingleSelect,
  SingleSelectOption,
  TextInput,
  Typography,
} from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';
import { MarkdownEditor } from './components/MarkdownEditor';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface AnnouncementData {
  message: string;
  type: string;
  ctaLabel: string;
  ctaUrl: string;
}

const EMPTY: AnnouncementData = {
  message: '',
  type: 'info',
  ctaLabel: '',
  ctaUrl: '',
};

const TYPE_OPTIONS = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Avertisment' },
  { value: 'success', label: 'Succes' },
  { value: 'error', label: 'Eroare' },
];

export default function AnnouncementEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<AnnouncementData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      return { ...EMPTY, ...(v as AnnouncementData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      setData({ ...EMPTY, ...(v as AnnouncementData) });
  }, [field.value]);

  const commit = (next: AnnouncementData) => {
    setData(next);
    field.onChange(name, next);
  };

  const update = (key: keyof AnnouncementData, val: string) => {
    commit({ ...data, [key]: val });
  };

  return (
    <Box width="100%">
      <EditorCard
        title="Conținut Anunț Popup"
        description="Mesajul și butonul de acțiune afișate în popup-ul de anunț. Activarea/dezactivarea se face din câmpurile de mai sus."
      >
        <Box padding={4}>
          <Grid.Root gridCols={12} gap={4}>

            {/* Message - full width */}
            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="message" label="Mesaj anunț" hint="Textul principal afișat în popup-ul de anunț. Suportă markdown și o imagine.">
                <MarkdownEditor
                  id="message"
                  value={data.message}
                  placeholder="Textul anunțului..."
                  onChange={(val) => update('message', val)}
                  features={{ image: 1 }}
                />
              </EditorField>
            </Grid.Item>

            {/* Type selector - dropdown */}
            <Grid.Item col={6} s={12} xs={12}>
              <Field.Root id="ann-type" name="type" hint="Determină culoarea și iconița popup-ului" width="100%">
                <Field.Label>Tip anunț</Field.Label>
                <SingleSelect
                  id="ann-type"
                  value={data.type}
                  onChange={(val) => update('type', String(val))}
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <SingleSelectOption key={opt.value} value={opt.value}>
                      {opt.label}
                    </SingleSelectOption>
                  ))}
                </SingleSelect>
                <Field.Hint />
              </Field.Root>
            </Grid.Item>

            {/* Section divider */}
            <Grid.Item col={12} s={12} xs={12}>
              <Box paddingBottom={2}>
                <Divider />
              </Box>
              <Typography variant="pi" fontWeight="semiBold" textColor="neutral600">
                Buton de acțiune (opțional)
              </Typography>
            </Grid.Item>

            {/* CTA Label - stacks to full-width on narrow viewports */}
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="ctaLabel" label="Text buton" hint="Textul butonului de acțiune, opțional">
                <TextInput
                  id="ctaLabel"
                  name="ctaLabel"
                  value={data.ctaLabel}
                  placeholder="ex: Înscrie-te acum"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    update('ctaLabel', e.target.value)
                  }
                />
              </EditorField>
            </Grid.Item>

            {/* CTA URL - stacks to full-width on narrow viewports */}
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="ctaUrl" label="Link buton" hint="Destinația butonului, ex: /inscrieri">
                <TextInput
                  id="ctaUrl"
                  name="ctaUrl"
                  value={data.ctaUrl}
                  placeholder="ex: /inscrieri"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    update('ctaUrl', e.target.value)
                  }
                />
              </EditorField>
            </Grid.Item>

          </Grid.Root>
        </Box>
      </EditorCard>
    </Box>
  );
}
