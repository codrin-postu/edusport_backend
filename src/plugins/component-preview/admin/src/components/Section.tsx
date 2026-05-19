import * as React from 'react';
import { Box, Flex, Typography } from '@strapi/design-system';

interface SectionProps {
  title: string;
  /** Suppress the top divider on the first section in a stack. */
  first?: boolean;
  /** Optional trailing element rendered to the right of the title (e.g. a button). */
  action?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Standard flat section header used across editor cards: an uppercase
 * `sigma`-typography title with an optional trailing action, separated from
 * preceding content by a thin top divider when not first. Replaces the inline
 * `Panel` / "title + paddingBottom" pattern that had drifted across editors.
 */
export function Section({ title, first, action, children }: SectionProps) {
  return (
    <Box
      paddingTop={first ? 0 : 5}
      borderColor={first ? undefined : 'neutral200'}
      borderStyle={first ? undefined : 'solid'}
      borderWidth={first ? undefined : '1px 0 0 0'}
    >
      <Flex
        justifyContent="space-between"
        alignItems="center"
        paddingBottom={3}
        gap={3}
      >
        <Typography variant="sigma" textColor="neutral600">
          {title.toUpperCase()}
        </Typography>
        {action}
      </Flex>
      {children}
    </Box>
  );
}
