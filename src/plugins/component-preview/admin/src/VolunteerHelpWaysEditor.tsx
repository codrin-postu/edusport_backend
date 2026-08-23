import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Flex, Grid, Textarea, TextInput } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';
import { DeleteIconButton } from './components/DeleteIconButton';
import { AddListButton } from './components/AddListButton';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface HelpWay {
  title: string;
  desc: string;
}

const EMPTY_WAY: HelpWay = { title: '', desc: '' };

const DEFAULT_WAYS: HelpWay[] = [
  { title: 'La competiții', desc: 'Culise și sprijin pentru sportivi în ziua concursului.' },
  { title: 'Organizare & logistică', desc: 'Pregătire materiale, transport și coordonare pe teren.' },
  { title: 'Cu cei mici', desc: 'Mentorat pentru începători la primii pași pe gheață.' },
  { title: 'Foto & promovare', desc: 'Fotografie, social media și povești din culise.' },
];

function normalize(value: unknown): HelpWay[] {
  if (!Array.isArray(value)) return DEFAULT_WAYS.map((w) => ({ ...w }));
  return (value as unknown[]).map((w) => {
    if (!w || typeof w !== 'object') return { ...EMPTY_WAY };
    const x = w as Partial<HelpWay>;
    return {
      title: typeof x.title === 'string' ? x.title : '',
      desc: typeof x.desc === 'string' ? x.desc : '',
    };
  });
}

export default function VolunteerHelpWaysEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<HelpWay[]>(() => normalize(field.value));

  React.useEffect(() => {
    setData(normalize(field.value));
  }, [field.value]);

  const commit = (next: HelpWay[]) => {
    setData(next);
    field.onChange(name, next);
  };

  const update = (index: number, key: keyof HelpWay, val: string) => {
    commit(data.map((w, i) => (i === index ? { ...w, [key]: val } : w)));
  };

  const add = () => commit([...data, { ...EMPTY_WAY }]);
  const remove = (index: number) => commit(data.filter((_, i) => i !== index));

  return (
    <Box width="100%">
      <EditorCard
        title="Moduri de a ajuta"
        description="Lista modurilor în care voluntarii pot contribui, afișate în secțiunea „Cum poți ajuta”."
      >
        <Box padding={4}>
          <Flex direction="column" alignItems="stretch" gap={2}>
            {data.map((way, i) => (
              <Box
                key={i}
                padding={3}
                background="neutral0"
                hasRadius
                borderColor="neutral200"
                borderStyle="solid"
                borderWidth="1px"
              >
                <Grid.Root gridCols={12} gap={3}>
                  <Grid.Item col={5} s={12} xs={12}>
                    <EditorField name={`way-${i}-title`} label="Titlu" hint="Numele rolului.">
                      <TextInput
                        id={`way-${i}-title`}
                        name={`way-${i}-title`}
                        value={way.title}
                        placeholder="ex: La competiții"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          update(i, 'title', e.target.value)
                        }
                      />
                    </EditorField>
                  </Grid.Item>
                  <Grid.Item col={6} s={10} xs={10}>
                    <EditorField name={`way-${i}-desc`} label="Descriere" hint="Un rând despre ce presupune.">
                      <TextInput
                        id={`way-${i}-desc`}
                        name={`way-${i}-desc`}
                        value={way.desc}
                        placeholder="ex: Culise și sprijin în ziua concursului."
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          update(i, 'desc', e.target.value)
                        }
                      />
                    </EditorField>
                  </Grid.Item>
                  <Grid.Item col={1} s={2} xs={2}>
                    <Flex justifyContent="flex-end" alignItems="flex-end" height="100%" paddingBottom={1}>
                      <DeleteIconButton
                        variant="subtle"
                        label="Șterge rolul"
                        onClick={() => remove(i)}
                      />
                    </Flex>
                  </Grid.Item>
                </Grid.Root>
              </Box>
            ))}
            <AddListButton onClick={add} label="Adaugă rol" />
          </Flex>
        </Box>
      </EditorCard>
    </Box>
  );
}
