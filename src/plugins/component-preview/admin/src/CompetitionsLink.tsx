import * as React from 'react';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

function useDark() {
  const [dark, setDark] = React.useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  );
  React.useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.getAttribute('data-theme') === 'dark'),
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export default function CompetitionsLink(_props: Props) {
  const dark = useDark();

  const border = dark ? '#2a2a3e' : '#d0d0e0';
  const bg = dark ? '#16162a' : '#f8f8fc';
  const headerBg = dark ? '#1a1a30' : '#eeeef8';
  const titleColor = dark ? '#9999cc' : '#4a4a88';
  const descColor = dark ? '#888' : '#666';
  const btnBorder = dark ? '#4a4a88' : '#aaaacc';
  const btnColor = dark ? '#9999dd' : '#5555aa';
  const btnBg = dark ? '#1e1e38' : '#ededf8';
  const btnHoverBg = dark ? '#26263e' : '#e0e0f2';

  const [hovered, setHovered] = React.useState(false);

  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden', background: bg }}>
      {/* Header */}
      <div style={{ padding: '12px 16px 10px', borderBottom: `1px solid ${border}`, background: headerBg, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: titleColor }}>
          Competiții & Rezultate
        </span>
        <span style={{ fontSize: 11, color: descColor, lineHeight: 1.6 }}>
          Competițiile și rezultatele sportivilor sunt gestionate separat, ca înregistrări individuale, organizate pe sezoane.
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: descColor, lineHeight: 1.6 }}>
          Adaugă sau editează competițiile și rezultatele din secțiunea dedicată.
        </span>
        <a
          href="/admin/content-manager/collection-types/api::competition.competition"
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            border: `1px solid ${btnBorder}`,
            borderRadius: 6,
            background: hovered ? btnHoverBg : btnBg,
            color: btnColor,
            fontSize: 12,
            fontWeight: 600,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            transition: 'background 0.15s',
            cursor: 'pointer',
          }}
        >
          ↗ Gestionează competițiile
        </a>
      </div>
    </div>
  );
}
