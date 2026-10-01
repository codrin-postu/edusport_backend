import * as React from 'react';
import { Box, Flex, Typography } from '@strapi/design-system';

interface EditorCardProps {
  title: string;
  description?: string;
  /** Optional action rendered right-aligned in the header (e.g. "+ Adaugă" button) */
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export function EditorCard({ title, description, headerAction, children }: EditorCardProps) {
  return (
    <Box
      borderColor="neutral200"
      borderStyle="solid"
      borderWidth="1px"
      borderRadius="4px"
      overflow="hidden"
      background="neutral100"
    >
      {/* Header, neutral700 text for readability. (The left accent and bottom line were
          set through Box props the design system does not have, so they never rendered.) */}
      <Box
        padding={4}
        background="neutral100"
      >
        <Flex justifyContent="space-between" alignItems="center" paddingBottom={description ? 1 : 0}>
          <Typography variant="omega" fontWeight="semiBold" textColor="neutral700">
            {title}
          </Typography>
          {headerAction}
        </Flex>
        {description && (
          <Typography variant="pi" textColor="neutral500">
            {description}
          </Typography>
        )}
      </Box>

      {/* Body */}
      <Box background="neutral0">{children}</Box>
    </Box>
  );
}
