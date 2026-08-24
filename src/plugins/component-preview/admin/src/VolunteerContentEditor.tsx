import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Grid, Textarea, TextInput } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';
import { Section } from './components/Section';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface ContentData {
  heroTitle: string;
  heroSubtitle: string;
  introEyebrow: string;
  introHeading: string;
  introBody: string;
}

const EMPTY: ContentData = {
  heroTitle: '',
  heroSubtitle: '',
  introEyebrow: '',
  introHeading: '',
  introBody: '',
};

function normalize(value: unknown): ContentData {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...EMPTY, ...(value as Partial<ContentData>) };
  }
  return { ...EMPTY };
}

export default function VolunteerContentEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<ContentData>(() => normalize(field.value));

  React.useEffect(() => {
    setData(normalize(field.value));
  }, [field.value]);

  const update = (key: keyof ContentData, val: string) => {
    const next = { ...data, [key]: val };
    setData(next);
    field.onChange(name, next);
  };

  return (
    <Box width="100%">
      <EditorCard
        title="Voluntariat - Text pagină"
        description="Titlul din antet și textul introductiv „De ce voluntariat”."
      >
        <Box padding={4}>
          <Section title="Antet (hero)" first>
            <Grid.Root gridCols={12} gap={4}>
              <Grid.Item col={6} s={12} xs={12}>
                <EditorField name="heroTitle" label="Titlu" hint="Titlul mare din antet.">
                  <TextInput
                    id="heroTitle"
                    name="heroTitle"
                    value={data.heroTitle}
                    placeholder="ex: Voluntariat"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      update('heroTitle', e.target.value)
                    }
                  />
                </EditorField>
              </Grid.Item>
              <Grid.Item col={12} s={12} xs={12}>
                <EditorField name="heroSubtitle" label="Subtitlu" hint="Textul de sub titlu.">
                  <Textarea
                    id="heroSubtitle"
                    name="heroSubtitle"
                    rows={2}
                    value={data.heroSubtitle}
                    placeholder="ex: Clubul crește cu oameni care dăruiesc timp..."
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      update('heroSubtitle', e.target.value)
                    }
                  />
                </EditorField>
              </Grid.Item>
            </Grid.Root>
          </Section>

          <Section title="Introducere (De ce voluntariat)">
            <Grid.Root gridCols={12} gap={4}>
              <Grid.Item col={6} s={12} xs={12}>
                <EditorField name="introEyebrow" label="Etichetă mică" hint="Textul mic deasupra titlului.">
                  <TextInput
                    id="introEyebrow"
                    name="introEyebrow"
                    value={data.introEyebrow}
                    placeholder="ex: De ce voluntariat"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      update('introEyebrow', e.target.value)
                    }
                  />
                </EditorField>
              </Grid.Item>
              <Grid.Item col={6} s={12} xs={12}>
                <EditorField name="introHeading" label="Titlu secțiune">
                  <TextInput
                    id="introHeading"
                    name="introHeading"
                    value={data.introHeading}
                    placeholder="ex: Timpul tău face diferența"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      update('introHeading', e.target.value)
                    }
                  />
                </EditorField>
              </Grid.Item>
              <Grid.Item col={12} s={12} xs={12}>
                <EditorField name="introBody" label="Text" hint="Paragraful introductiv.">
                  <Textarea
                    id="introBody"
                    name="introBody"
                    rows={4}
                    value={data.introBody}
                    placeholder="ex: Experiență reală lângă antrenori și sportivi, prieteni noi..."
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      update('introBody', e.target.value)
                    }
                  />
                </EditorField>
              </Grid.Item>
            </Grid.Root>
          </Section>
        </Box>
      </EditorCard>
    </Box>
  );
}
