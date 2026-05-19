import * as React from 'react';
import { Box, Flex, LinkButton, Typography } from '@strapi/design-system';
import { ArrowRight } from '@strapi/icons';
import { EditorCard } from './EditorCard';

interface LinkOutCardProps {
  /** Card title shown in the header (e.g. "Membri echipă"). */
  title: string;
  /** Optional sub-line under the title. */
  description?: string;
  /** Body copy explaining what the link does. */
  body: string;
  /** Outbound href - Strapi admin URL or external URL. */
  href: string;
  /** Button label (e.g. "Gestionează membrii echipei"). */
  linkLabel: string;
  /** When true, opens the link in a new tab (default). */
  external?: boolean;
}

/**
 * Card that points the editor to a related collection in Content Manager.
 * Used wherever a custom field exists only to surface a navigation link
 * (relations are managed elsewhere, not inline).
 */
export function LinkOutCard({
  title,
  description,
  body,
  href,
  linkLabel,
  external = true,
}: LinkOutCardProps) {
  return (
    <EditorCard title={title} description={description}>
      <Box padding={4}>
        <Flex justifyContent="space-between" alignItems="center" gap={3} wrap="wrap">
          <Typography variant="omega" textColor="neutral600">
            {body}
          </Typography>
          <LinkButton
            href={href}
            variant="secondary"
            endIcon={<ArrowRight />}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {linkLabel}
          </LinkButton>
        </Flex>
      </Box>
    </EditorCard>
  );
}
