import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import {
  Box,
  Button,
  Field,
  Flex,
  Textarea,
  TextInput,
  Typography,
} from '@strapi/design-system';
import { Plus } from '@strapi/icons';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';
import { DeleteIconButton } from './components/DeleteIconButton';
import { AddListButton } from './components/AddListButton';
import { Section } from './components/Section';

interface Tier {
  label: string;
  price: string;
  tooltip?: string;
  note?: string;
}

interface PricingData {
  memberTiers: Tier[];
  nonMemberTiers: Tier[];
  memberFeeLabel?: string;
  memberFeePrice?: string;
}

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

const EMPTY: PricingData = {
  memberTiers: [],
  nonMemberTiers: [],
  memberFeeLabel: '',
  memberFeePrice: '',
};

type Side = 'memberTiers' | 'nonMemberTiers';

export default function PricingTiersEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<PricingData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) return { ...EMPTY, ...(v as PricingData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      setData({ ...EMPTY, ...(v as PricingData) });
  }, [field.value]);

  const commit = (next: PricingData) => {
    setData(next);
    field.onChange(name, next);
  };

  const updateTier = (side: Side, i: number, key: keyof Tier, val: string) => {
    const tiers = [...data[side]];
    tiers[i] = { ...tiers[i], [key]: val };
    commit({ ...data, [side]: tiers });
  };

  const addTier = (side: Side) =>
    commit({ ...data, [side]: [...data[side], { label: '', price: '' }] });

  const removeTier = (side: Side, i: number) =>
    commit({ ...data, [side]: data[side].filter((_, idx) => idx !== i) });

  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      let changed = false;
      (['memberTiers', 'nonMemberTiers'] as Side[]).forEach((side) => {
        data[side].forEach((tier, i) => {
          const key = `${side}:${i}`;
          if ((tier.tooltip || tier.note) && !next.has(key)) {
            next.add(key);
            changed = true;
          }
        });
      });
      return changed ? next : prev;
    });
  }, [data]);

  const isExpanded = (side: Side, i: number) => expandedRows.has(`${side}:${i}`);

  const toggleExpanded = (side: Side, i: number) => {
    const key = `${side}:${i}`;
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderSection = (side: Side) => {
    const tiers = data[side];
    return (
      <Box>
        {tiers.length === 0 ? (
          <Box paddingBottom={3}>
            <Typography variant="omega" textColor="neutral500" fontStyle="italic">
              Niciun rând adăugat
            </Typography>
          </Box>
        ) : (
          <Flex direction="column" gap={0} alignItems="stretch">
            {tiers.map((tier, i) => {
              const isLast = i === tiers.length - 1;
              return (
                <Box
                  key={i}
                  paddingTop={i === 0 ? 0 : 4}
                  paddingBottom={4}
                  borderColor="neutral200"
                  borderStyle="solid"
                  borderWidth={isLast ? '0' : '0 0 1px 0'}
                >
                  <Flex justifyContent="space-between" alignItems="center" paddingBottom={3}>
                    <Typography variant="pi" fontWeight="bold" textColor="neutral500">
                      Rând #{i + 1}
                    </Typography>
                    <DeleteIconButton
                      onClick={() => removeTier(side, i)}
                      label={`Șterge rândul ${i + 1}`}
                      variant="danger"
                    />
                  </Flex>

                  <Flex direction="column" gap={3} alignItems="stretch">
                    <Flex gap={3} alignItems="flex-start" wrap="wrap">
                      <Box style={{ flex: '1 1 180px', minWidth: 0 }}>
                        <Field.Root id={`${name}-${side}-${i}-label`} name={`${name}-${side}-${i}-label`}>
                          <Field.Label>Etichetă</Field.Label>
                          <TextInput
                            id={`${name}-${side}-${i}-label`}
                            value={tier.label}
                            placeholder="Etichetă…"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              updateTier(side, i, 'label', e.target.value)
                            }
                          />
                        </Field.Root>
                      </Box>
                      <Box style={{ flex: '1 1 180px', minWidth: 0 }}>
                        <Field.Root id={`${name}-${side}-${i}-price`} name={`${name}-${side}-${i}-price`}>
                          <Field.Label>Preț</Field.Label>
                          <TextInput
                            id={`${name}-${side}-${i}-price`}
                            value={tier.price}
                            placeholder="ex: 350 lei / lună"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              updateTier(side, i, 'price', e.target.value)
                            }
                          />
                        </Field.Root>
                      </Box>
                    </Flex>

                    {isExpanded(side, i) ? (
                      <>
                        <Field.Root id={`${name}-${side}-${i}-tooltip`} name={`${name}-${side}-${i}-tooltip`} hint="Opțional">
                          <Field.Label>Tooltip</Field.Label>
                          <Textarea
                            id={`${name}-${side}-${i}-tooltip`}
                            value={tier.tooltip ?? ''}
                            rows={1}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                              updateTier(side, i, 'tooltip', e.target.value)
                            }
                          />
                          <Field.Hint />
                        </Field.Root>

                        <Field.Root
                          id={`${name}-${side}-${i}-note`}
                          name={`${name}-${side}-${i}-note`}
                          hint="Opțional · text mic afișat sub numele prețului"
                        >
                          <Field.Label>Notă sub etichetă</Field.Label>
                          <Textarea
                            id={`${name}-${side}-${i}-note`}
                            value={tier.note ?? ''}
                            rows={1}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                              updateTier(side, i, 'note', e.target.value)
                            }
                          />
                          <Field.Hint />
                        </Field.Root>

                        <Box>
                          <Button
                            variant="tertiary"
                            size="S"
                            disabled={!!tier.tooltip || !!tier.note}
                            onClick={() => toggleExpanded(side, i)}
                          >
                            Ascunde detalii opționale
                          </Button>
                        </Box>
                      </>
                    ) : (
                      <Box>
                        <Button
                          variant="tertiary"
                          size="S"
                          startIcon={<Plus />}
                          onClick={() => toggleExpanded(side, i)}
                        >
                          Adaugă tooltip / notă
                        </Button>
                      </Box>
                    )}
                  </Flex>
                </Box>
              );
            })}
          </Flex>
        )}

        <Box
          paddingTop={tiers.length === 0 ? 0 : 4}
          borderColor={tiers.length === 0 ? undefined : 'neutral200'}
          borderStyle={tiers.length === 0 ? undefined : 'solid'}
          borderWidth={tiers.length === 0 ? undefined : '1px 0 0 0'}
        >
          <AddListButton onClick={() => addTier(side)} label="Adaugă rând" />
        </Box>
      </Box>
    );
  };

  return (
    <Flex direction="column" gap={4} alignItems="stretch" width="100%">
      <EditorCard
        title="Prețuri curs membri"
        description="Tarifele afișate pentru cursanții cu abonament."
      >
        <Box padding={4}>
          <Flex direction="column" alignItems="stretch">
            <Section title="Tarife" first>
              {renderSection('memberTiers')}
            </Section>
            <Section title="Taxă membru">
              <Flex gap={3} alignItems="flex-start" wrap="wrap">
                <Box style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <EditorField name="memberFeeLabel" label="Etichetă taxă">
                    <TextInput
                      id="memberFeeLabel"
                      name="memberFeeLabel"
                      value={data.memberFeeLabel ?? ''}
                      placeholder="Etichetă taxă…"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        commit({ ...data, memberFeeLabel: e.target.value })
                      }
                    />
                  </EditorField>
                </Box>
                <Box style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <EditorField name="memberFeePrice" label="Preț">
                    <TextInput
                      id="memberFeePrice"
                      name="memberFeePrice"
                      value={data.memberFeePrice ?? ''}
                      placeholder="ex: 100 lei"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        commit({ ...data, memberFeePrice: e.target.value })
                      }
                    />
                  </EditorField>
                </Box>
              </Flex>
            </Section>
          </Flex>
        </Box>
      </EditorCard>

      <EditorCard
        title="Prețuri curs non-membri"
        description="Tarifele afișate pentru cursanții fără abonament."
      >
        <Box padding={4}>
          {renderSection('nonMemberTiers')}
        </Box>
      </EditorCard>
    </Flex>
  );
}
