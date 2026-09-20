import * as React from 'react';
import { LinkOutCard } from './components/LinkOutCard';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

/**
 * Links to the custom Competitii list, not Strapi's generic content manager.
 * Competitions are edited through CompetitiiPage / CompetitieEditPage, so
 * pointing at the raw content-manager view dropped editors into a different
 * editing experience from the one the sidebar uses.
 */
export default function CompetitionsLink(_props: Props) {
  return (
    <LinkOutCard
      title="Competiții & Rezultate"
      description="Competițiile și rezultatele sportivilor sunt gestionate separat, ca înregistrări individuale, organizate pe sezoane."
      body="Adaugă sau editează competițiile și rezultatele din secțiunea dedicată."
      href="/admin/plugins/edusport-competitii"
      linkLabel="Gestionează competițiile"
    />
  );
}
