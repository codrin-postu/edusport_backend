import * as React from 'react';
import { LinkOutCard } from './components/LinkOutCard';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

export default function CompetitionsLink(_props: Props) {
  return (
    <LinkOutCard
      title="Competiții & Rezultate"
      description="Competițiile și rezultatele sportivilor sunt gestionate separat, ca înregistrări individuale, organizate pe sezoane."
      body="Adaugă sau editează competițiile și rezultatele din secțiunea dedicată."
      href="/admin/content-manager/collection-types/api::competition.competition"
      linkLabel="Gestionează competițiile"
    />
  );
}
