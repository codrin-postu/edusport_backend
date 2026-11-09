import * as React from 'react';
import { BRAND_LAYER_ID, brandInner } from '../admin/dashboard/loginBranding';
import { Notice } from '../admin/ui/Notice';
import { SECURITY_COPY } from '../club/security/copy';

/** The brand layer on the left, the form column on the right; phones show the wordmark above the form. */
export function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ui-root ia-root">
      <div id={BRAND_LAYER_ID} aria-hidden="true" dangerouslySetInnerHTML={{ __html: brandInner(SECURITY_COPY.login.brand) }} />
      <main className="ia-form">
        <div className="ia-card">
          <h2 className="ia-title">{title}</h2>
          {children}
        </div>
      </main>
    </div>
  );
}

/** A refusal or a note above the form; the text is the server's, as sent. */
export const Problem = ({ text }: { text: string | null }) => (text ? <Notice tone="danger">{text}</Notice> : null);
