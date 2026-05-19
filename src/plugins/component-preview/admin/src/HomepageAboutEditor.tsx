import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import {
  Box,
  Checkbox,
  Flex,
  Grid,
  SingleSelect,
  SingleSelectOption,
  Textarea,
  TextInput,
  Typography,
} from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';
import { Section } from './components/Section';
import { DeleteIconButton } from './components/DeleteIconButton';
import { AddListButton } from './components/AddListButton';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface AboutPanel {
  eyebrow: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}

type NotebookLineStyle = 'normal' | 'strikethrough' | 'scratched';

interface NotebookLine {
  text: string;
  style: NotebookLineStyle;
  indent?: boolean;
  dim?: boolean;
  replacement?: string;
}

interface AboutData {
  panels: AboutPanel[];
  notebook: NotebookLine[];
}

const EMPTY_PANEL: AboutPanel = { eyebrow: '', heading: '', body: '', ctaLabel: '', ctaUrl: '' };

const EMPTY_LINE: NotebookLine = { text: '', style: 'normal' };

const DEFAULT_NOTEBOOK: NotebookLine[] = [
  { text: 'Plan', style: 'normal' },
  { text: '', style: 'normal' },
  { text: 'Muzică:', style: 'normal', dim: true },
  { text: 'Swan Lake - Tchaikovsky', style: 'strikethrough', indent: true },
  { text: 'Clair de Lune - Debussy', style: 'scratched', indent: true, replacement: "Comptine d'un autre été" },
  { text: '', style: 'normal' },
  { text: 'Elemente:', style: 'normal', dim: true },
  { text: 'Axel simplu', style: 'normal', indent: true },
  { text: 'Lutz + toe loop', style: 'normal', indent: true },
  { text: 'Piruetă combinată', style: 'scratched', indent: true, replacement: 'Camel spin' },
  { text: 'Step sequence nivel 2', style: 'normal', indent: true },
  { text: 'Spiral sequence', style: 'normal', indent: true },
];

const PANEL_COUNT = 3;

const PANEL_TITLES = ['Panou #1', 'Panou #2', 'Panou #3'];

const PANEL_HINTS = [
  'Primul panou - în mod uzual „Cine suntem".',
  'Al doilea panou - în mod uzual „Echipa noastră".',
  'Al treilea panou - în mod uzual „Realizările noastre".',
];

const STYLE_OPTIONS: { value: NotebookLineStyle; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'strikethrough', label: 'Tăiat (linie peste)' },
  { value: 'scratched', label: 'Înlocuit (mâzgălit cu variantă nouă)' },
];

// Lift the legacy single-panel shape (`{ eyebrow, heading, body, ctaLabel, ctaUrl }`)
// into the new `{ panels: [...], notebook: [...] }` shape, padding panels and
// seeding the notebook with the default lines when missing. Idempotent.
function normalize(value: unknown): AboutData {
  const ensureLength = (panels: AboutPanel[]): AboutPanel[] => {
    const next = panels.slice(0, PANEL_COUNT);
    while (next.length < PANEL_COUNT) next.push({ ...EMPTY_PANEL });
    return next;
  };
  const normalizeLines = (raw: unknown): NotebookLine[] => {
    if (!Array.isArray(raw)) return DEFAULT_NOTEBOOK.map((l) => ({ ...l }));
    return (raw as unknown[]).map((l) => {
      if (!l || typeof l !== 'object') return { ...EMPTY_LINE };
      const x = l as Partial<NotebookLine>;
      return {
        text: typeof x.text === 'string' ? x.text : '',
        style: (x.style === 'strikethrough' || x.style === 'scratched') ? x.style : 'normal',
        indent: !!x.indent,
        dim: !!x.dim,
        replacement: typeof x.replacement === 'string' ? x.replacement : undefined,
      };
    });
  };

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { panels: ensureLength([]), notebook: DEFAULT_NOTEBOOK.map((l) => ({ ...l })) };
  }
  const v = value as Record<string, unknown>;
  if (Array.isArray(v.panels)) {
    const panels = (v.panels as unknown[]).map((p) => ({
      ...EMPTY_PANEL,
      ...(p && typeof p === 'object' ? (p as Partial<AboutPanel>) : {}),
    }));
    return { panels: ensureLength(panels), notebook: normalizeLines(v.notebook) };
  }
  // Legacy shape - single panel at the root, no notebook.
  if ('eyebrow' in v || 'heading' in v || 'body' in v) {
    return {
      panels: ensureLength([{ ...EMPTY_PANEL, ...(v as Partial<AboutPanel>) }]),
      notebook: DEFAULT_NOTEBOOK.map((l) => ({ ...l })),
    };
  }
  return { panels: ensureLength([]), notebook: DEFAULT_NOTEBOOK.map((l) => ({ ...l })) };
}

export default function HomepageAboutEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<AboutData>(() => normalize(field.value));

  React.useEffect(() => {
    setData(normalize(field.value));
  }, [field.value]);

  const commit = (next: AboutData) => {
    setData(next);
    field.onChange(name, next);
  };

  const updatePanel = (index: number, key: keyof AboutPanel, val: string) => {
    commit({
      ...data,
      panels: data.panels.map((p, i) => (i === index ? { ...p, [key]: val } : p)),
    });
  };

  const updateLine = <K extends keyof NotebookLine>(index: number, key: K, val: NotebookLine[K]) => {
    commit({
      ...data,
      notebook: data.notebook.map((l, i) => (i === index ? { ...l, [key]: val } : l)),
    });
  };

  const addLine = () => {
    commit({ ...data, notebook: [...data.notebook, { ...EMPTY_LINE }] });
  };

  const removeLine = (index: number) => {
    commit({ ...data, notebook: data.notebook.filter((_, i) => i !== index) });
  };

  return (
    <Box width="100%">
      <EditorCard
        title="Secțiunea Cine Suntem"
        description="Trei panouri pe pagina principală care se schimbă la scroll: Cine suntem, Echipa noastră și Realizările noastre. Fiecare panou are propriile texte și propriul link."
      >
        <Box padding={4}>
          <Flex direction="column" alignItems="stretch">
            {data.panels.map((panel, i) => (
              <Section key={i} title={PANEL_TITLES[i]} first={i === 0}>
                <Box paddingBottom={3}>
                  <em
                    style={{
                      fontSize: 13,
                      color: 'rgb(102, 102, 135)',
                    }}
                  >
                    {PANEL_HINTS[i]}
                  </em>
                </Box>
                <Grid.Root gridCols={12} gap={4}>
                  <Grid.Item col={6} s={12} xs={12}>
                    <EditorField
                      name={`panel-${i}-eyebrow`}
                      label="Etichetă mică (eyebrow)"
                      hint="Textul mic deasupra titlului."
                    >
                      <TextInput
                        id={`panel-${i}-eyebrow`}
                        name={`panel-${i}-eyebrow`}
                        value={panel.eyebrow}
                        placeholder={i === 0 ? 'ex: Cine suntem' : i === 1 ? 'ex: Echipa noastră' : 'ex: Realizările noastre'}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updatePanel(i, 'eyebrow', e.target.value)
                        }
                      />
                    </EditorField>
                  </Grid.Item>
                  <Grid.Item col={6} s={12} xs={12}>
                    <EditorField name={`panel-${i}-heading`} label="Titlu principal" hint="Titlul panoului. Apasă Enter pentru linie nouă.">
                      <TextInput
                        id={`panel-${i}-heading`}
                        name={`panel-${i}-heading`}
                        value={panel.heading}
                        placeholder="ex: Asociație non-profit pentru sport și educație"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updatePanel(i, 'heading', e.target.value)
                        }
                      />
                    </EditorField>
                  </Grid.Item>

                  <Grid.Item col={12} s={12} xs={12}>
                    <EditorField name={`panel-${i}-body`} label="Text panou" hint="Descrierea afișată sub titlu.">
                      <Textarea
                        id={`panel-${i}-body`}
                        name={`panel-${i}-body`}
                        value={panel.body}
                        rows={3}
                        placeholder="ex: Fondată în 2012, EduSport este o asociație non-profit dedicată..."
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          updatePanel(i, 'body', e.target.value)
                        }
                      />
                    </EditorField>
                  </Grid.Item>

                  <Grid.Item col={6} s={12} xs={12}>
                    <EditorField name={`panel-${i}-cta-label`} label="Text link" hint="Textul linkului/butonului.">
                      <TextInput
                        id={`panel-${i}-cta-label`}
                        name={`panel-${i}-cta-label`}
                        value={panel.ctaLabel}
                        placeholder={i === 0 ? 'ex: Despre noi' : i === 1 ? 'ex: Cunoaște echipa' : 'ex: Vezi realizările'}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updatePanel(i, 'ctaLabel', e.target.value)
                        }
                      />
                    </EditorField>
                  </Grid.Item>
                  <Grid.Item col={6} s={12} xs={12}>
                    <EditorField name={`panel-${i}-cta-url`} label="Destinație link" hint="Pagina spre care duce.">
                      <TextInput
                        id={`panel-${i}-cta-url`}
                        name={`panel-${i}-cta-url`}
                        value={panel.ctaUrl}
                        placeholder={i === 0 ? '/despre-noi' : i === 1 ? '/despre-noi/echipa' : '/despre-noi/realizari'}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updatePanel(i, 'ctaUrl', e.target.value)
                        }
                      />
                    </EditorField>
                  </Grid.Item>
                </Grid.Root>
              </Section>
            ))}

            <Section title="Caiet (notițele din lateral)">
              <Box paddingBottom={3}>
                <Typography variant="pi" textColor="neutral600">
                  Liniile mâzgălite în caietul desenat lângă cele 3 panouri. Lasă text gol pentru spațiu între blocuri. Stilul „Înlocuit" arată textul tăiat cu mâzgălitură și varianta nouă scrisă alături.
                </Typography>
              </Box>
              <Flex direction="column" alignItems="stretch" gap={2}>
                {data.notebook.map((line, i) => (
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
                      <Grid.Item col={6} s={12} xs={12}>
                        <EditorField name={`line-${i}-text`} label="Text" hint="Lasă gol pentru o linie de spațiu.">
                          <TextInput
                            id={`line-${i}-text`}
                            name={`line-${i}-text`}
                            value={line.text}
                            placeholder="ex: Axel simplu"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              updateLine(i, 'text', e.target.value)
                            }
                          />
                        </EditorField>
                      </Grid.Item>
                      <Grid.Item col={5} s={10} xs={10}>
                        <EditorField name={`line-${i}-style`} label="Stil" hint="Cum arată linia în caiet.">
                          <SingleSelect
                            id={`line-${i}-style`}
                            value={line.style}
                            onChange={(val) =>
                              updateLine(i, 'style', val as NotebookLineStyle)
                            }
                          >
                            {STYLE_OPTIONS.map((opt) => (
                              <SingleSelectOption key={opt.value} value={opt.value}>
                                {opt.label}
                              </SingleSelectOption>
                            ))}
                          </SingleSelect>
                        </EditorField>
                      </Grid.Item>
                      <Grid.Item col={1} s={2} xs={2}>
                        <Flex justifyContent="flex-end" alignItems="flex-end" height="100%" paddingBottom={1}>
                          <DeleteIconButton
                            variant="subtle"
                            label="Șterge linia"
                            onClick={() => removeLine(i)}
                          />
                        </Flex>
                      </Grid.Item>

                      {line.style === 'scratched' && (
                        <Grid.Item col={6} s={12} xs={12}>
                          <EditorField
                            name={`line-${i}-replacement`}
                            label="Variantă nouă"
                            hint="Textul scris lângă cel mâzgălit."
                          >
                            <TextInput
                              id={`line-${i}-replacement`}
                              name={`line-${i}-replacement`}
                              value={line.replacement ?? ''}
                              placeholder="ex: Camel spin"
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                updateLine(i, 'replacement', e.target.value)
                              }
                            />
                          </EditorField>
                        </Grid.Item>
                      )}

                      <Grid.Item col={6} s={12} xs={12}>
                        <Flex gap={4} alignItems="center" paddingTop={2}>
                          <Checkbox
                            checked={!!line.indent}
                            onCheckedChange={(checked) =>
                              updateLine(i, 'indent', !!checked)
                            }
                          >
                            Indentat (sub-element)
                          </Checkbox>
                          <Checkbox
                            checked={!!line.dim}
                            onCheckedChange={(checked) =>
                              updateLine(i, 'dim', !!checked)
                            }
                          >
                            Estompat (titlu de secțiune)
                          </Checkbox>
                        </Flex>
                      </Grid.Item>
                    </Grid.Root>
                  </Box>
                ))}
                <AddListButton onClick={addLine} label="Adaugă linie" />
              </Flex>
            </Section>
          </Flex>
        </Box>
      </EditorCard>
    </Box>
  );
}
