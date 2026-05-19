import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Field, Flex, Toggle, Typography } from '@strapi/design-system';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

export default function AnnouncementIsActiveEditor({ name }: Props) {
  const field = useField(name);
  const checked = Boolean(field.value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    field.onChange(name, e.target.checked);
  };

  return (
    <Box width="100%">
      <Field.Root id={name} name={name}>
        <Field.Label>Stare anunț</Field.Label>
        <Box marginTop={2}>
          <Flex wrap="wrap" gap={3} alignItems="center">
            <Toggle
              id={name}
              checked={checked}
              onChange={handleChange}
              onLabel="Activ"
              offLabel="Inactiv"
            />
            <Typography
              variant="omega"
              fontWeight="semiBold"
              textColor={checked ? 'success600' : 'neutral500'}
            >
              {checked ? 'Anunțul este vizibil pe site' : 'Anunțul este ascuns'}
            </Typography>
          </Flex>
        </Box>
        <Box marginTop={1}>
          <Typography variant="pi" textColor="neutral500">
            Activați comutatorul pentru a afișa anunțul vizitatorilor site-ului.
          </Typography>
        </Box>
      </Field.Root>
    </Box>
  );
}
