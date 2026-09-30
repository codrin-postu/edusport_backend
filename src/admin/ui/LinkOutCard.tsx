import * as React from 'react';
import { EditorCard } from './EditorCard';
import { IconArrowRight } from './icons';

export interface LinkOutCardProps {
  /** Card title, e.g. "Membri echipă". */
  title: React.ReactNode;
  description?: React.ReactNode;
  /** What the link is for. */
  body: React.ReactNode;
  /** Admin URL or external URL. */
  href: string;
  /** Button text, e.g. "Gestionează membrii echipei". */
  linkLabel: string;
  /** Open in a new tab. Default true (same as the plugin card). */
  external?: boolean;
}

/**
 * EditorCard that sends the editor to a related collection (relations that
 * are managed elsewhere, not inline). Port of the plugin's
 * components/LinkOutCard, on tokens.
 */
export function LinkOutCard({ title, description, body, href, linkLabel, external = true }: LinkOutCardProps) {
  return (
    <EditorCard title={title} description={description}>
      <div className="ui-linkout">
        <p className="ui-linkout-text">{body}</p>
        <a className="ui-btn ui-btn--secondary" href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {linkLabel}
          <IconArrowRight />
          {external && <span className="ui-sr"> (se deschide într-o filă nouă)</span>}
        </a>
      </div>
    </EditorCard>
  );
}

export default LinkOutCard;
