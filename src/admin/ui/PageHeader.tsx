import * as React from 'react';
import { Link } from 'react-router-dom';

export interface PageHeaderBack {
  /** Admin route (without the /admin basename), e.g. DASHBOARD_TO. */
  to?: string;
  onClick?: () => void;
  /** Default "Înapoi". */
  label?: string;
}

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Buttons on the right (they wrap under the title on phones). */
  actions?: React.ReactNode;
  back?: PageHeaderBack;
}

const Arrow = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
  </svg>
);

function BackLink({ back }: { back: PageHeaderBack }) {
  const label = back.label ?? 'Înapoi';
  if (back.to) {
    return (
      <Link className="adm-ph-back" to={back.to} onClick={back.onClick}>
        <Arrow />
        {label}
      </Link>
    );
  }
  return (
    <button type="button" className="adm-ph-back" onClick={back.onClick}>
      <Arrow />
      {label}
    </button>
  );
}

/** Page title block: optional back link, h1, subtitle, actions slot. */
export function PageHeader({ title, subtitle, actions, back }: PageHeaderProps) {
  return (
    <header className="adm-ph">
      <div>
        {back && <BackLink back={back} />}
        <h1 className="adm-ph-title">{title}</h1>
        {subtitle && <p className="adm-ph-sub">{subtitle}</p>}
      </div>
      {actions && <div className="adm-ph-actions">{actions}</div>}
    </header>
  );
}

export default PageHeader;
