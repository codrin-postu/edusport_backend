import * as React from 'react';
import { Flex } from '@strapi/design-system';
import { LinkOutCard } from './components/LinkOutCard';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

/**
 * Nav-only field for the Parteneri page: the sponsors and collaboration events
 * are managed as their own collections, so this just surfaces links to them
 * from the page editor (mirrors the realizari-page → Competiții pattern).
 */
export default function PartnersLinksEditor(_props: Props) {
  return (
    <Flex direction="column" alignItems="stretch" gap={4}>
      <LinkOutCard
        title="Sponsori"
        description="Logo-urile afișate în banda de sponsori sunt gestionate separat, ca înregistrări individuale."
        body="Adaugă, ordonează sau editează sponsorii din secțiunea dedicată."
        href="/admin/content-manager/collection-types/api::sponsor.sponsor"
        linkLabel="Gestionează sponsorii"
      />
      <LinkOutCard
        title="Evenimente & colaborări"
        description="Evenimentele realizate împreună cu partenerii sunt înregistrări individuale."
        body="Adaugă sau editează evenimentele de colaborare din secțiunea dedicată."
        href="/admin/content-manager/collection-types/api::collaboration-event.collaboration-event"
        linkLabel="Gestionează evenimentele"
      />
    </Flex>
  );
}
