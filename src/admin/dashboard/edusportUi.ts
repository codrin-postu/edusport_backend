/**
 * Shared UI tokens + helpers for the custom EduSport admin pages
 * (Sportivi / Competiții list + edit). Light-only, utilitarian: squared 4px
 * radius, no pill shapes, no dashed borders, horizontal-only table separators.
 * Palette mirrors InscrieriPage: system-ui, #fff chrome, #dcdcdc borders,
 * accent #2138b8, danger #be3330, #d0d0d0 fields.
 */

export const RO_MONTHS_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

// "2025-03-15" -> "15 mar 2025"
export function fmtDateRo(iso?: string | null): string {
  if (!iso) return '';
  const p = String(iso).slice(0, 10).split('-');
  if (p.length < 3) return String(iso);
  const y = Number(p[0]);
  const m = Number(p[1]) - 1;
  const d = Number(p[2]);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return String(iso);
  return `${d} ${RO_MONTHS_SHORT[m] ?? ''} ${y}`;
}

// "2023-01-01" -> "2023"
export function yearOf(iso?: string | null): string {
  if (!iso) return '';
  return String(iso).slice(0, 4);
}

export const PROGRAM_TYPES = ['Program Scurt', 'Program Liber', 'Program Exhibiție'] as const;

export const LEVEL_OPTIONS = [
  { value: 'national', label: 'Național' },
  { value: 'international', label: 'Internațional' },
] as const;

// Plain colored text for competition level (no pills).
export const LEVEL_COLOR: Record<string, string> = {
  national: '#1f7a4d',
  international: '#7a1fa2',
};
export const LEVEL_LABEL: Record<string, string> = {
  national: 'Național',
  international: 'Internațional',
};

// Shared stylesheet, scoped under `.eduf`. Injected once per page via <style>.
export const EDU_CSS = `
.eduf{--chrome:#fff;--ink:#1b1d22;--muted:#727888;--line:#e0e2e8;--border:#dcdcdc;
  --accent:#2138b8;--accent-soft:#eef1fb;--danger:#be3330;--field:#f7f8fa;--fieldborder:#d0d0d0;
  --ok:#1f7a4d;--r:4px;
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:#eef0f4;min-height:100%;padding:20px;box-sizing:border-box;line-height:1.5}
.eduf *{box-sizing:border-box}
.eduf .num{font-variant-numeric:tabular-nums}
.eduf a{color:var(--accent);text-decoration:none}

.eduf .win{background:var(--chrome);border:1px solid var(--border);border-radius:6px;box-shadow:0 4px 16px rgba(20,26,54,.06);overflow:hidden}

.eduf input,.eduf select,.eduf textarea{font-family:inherit;font-size:13px;color:var(--ink);background:var(--field);border:1px solid var(--fieldborder);border-radius:var(--r);padding:7px 9px}
.eduf textarea{resize:vertical}
.eduf input:focus,.eduf select:focus,.eduf textarea:focus{outline:none;border-color:var(--accent)}
.eduf .lbl{font-size:11px;color:var(--muted);font-weight:600}

.eduf .btn{font-family:inherit;font-size:12.5px;font-weight:600;padding:7px 12px;border-radius:var(--r);border:1px solid var(--fieldborder);background:var(--chrome);color:var(--ink);cursor:pointer;white-space:nowrap}
.eduf .btn:hover{border-color:#b6bac4;background:#fafbff}
.eduf .btn.pri{background:var(--accent);border-color:var(--accent);color:#fff}
.eduf .btn.pri:hover{background:#1b2fa0}
.eduf .btn.sm{padding:6px 10px;font-size:12px}
.eduf .btn:disabled{opacity:.55;cursor:default}
.eduf .btn.danger{color:var(--danger);border-color:#e2c4c4;background:#fff}
.eduf .btn.danger:hover{background:#fdf4f3}

/* header */
.eduf .hd{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid var(--line)}
.eduf .hd h1{margin:0;font-size:19px;font-weight:800;letter-spacing:-.01em}
.eduf .hd p{margin:3px 0 0;font-size:12.5px;color:var(--muted)}
.eduf .hd-right{display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end}

/* toolbar */
.eduf .tb{display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.eduf .search{flex:1;min-width:200px;display:flex;align-items:center;gap:7px;background:var(--field);border:1px solid var(--fieldborder);border-radius:var(--r);padding:7px 10px;color:var(--muted);font-size:13px}
.eduf .search input{border:none;background:none;outline:none;width:100%;color:var(--ink);font-size:13px;padding:0}

/* table: horizontal separators only */
.eduf .tbl{border-collapse:collapse;width:100%;font-size:13px}
.eduf .tbl th{text-align:left;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);font-weight:700;padding:10px 14px;border-bottom:1px solid var(--line);white-space:nowrap}
.eduf .tbl td{padding:10px 14px;border-bottom:1px solid #f0f1f4;vertical-align:middle}
.eduf .tbl tbody tr{cursor:pointer}
.eduf .tbl tbody tr:hover td{background:#fafbff}
.eduf .tbl .nm{font-weight:600}
.eduf .tbl .thumb{width:34px;height:34px;border-radius:var(--r);background:#eef1f8 center/cover no-repeat;border:1px solid var(--fieldborder);flex-shrink:0}
.eduf .tbl .thumb.ph{display:flex;align-items:center;justify-content:center;color:#9aa0ad;font-size:12px;font-weight:700}
.eduf .yes{color:var(--ok);font-weight:700}
.eduf .no{color:var(--muted)}
.eduf .relnames{color:var(--ink)}
.eduf .relnames.empty{color:#a4a9b4}

/* message + states */
.eduf .msg{font-size:12px;padding:8px 11px;border-radius:var(--r);margin:12px 18px 0}
.eduf .msg.ok{color:#1f7a4d;background:#e7f3ec;border:1px solid #bfe0cc}
.eduf .msg.err{color:#be3330;background:#faeceb;border:1px solid #e6c3c1}
.eduf .empty{padding:44px 16px;text-align:center;color:var(--muted);font-size:13.5px}
.eduf .foot{display:flex;align-items:center;gap:8px;padding:11px 18px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}

/* two-column edit layout */
.eduf .cols{display:grid;grid-template-columns:280px 1fr;gap:0;align-items:start}
@media (max-width:900px){.eduf .cols{grid-template-columns:1fr}}
.eduf .rail{border-right:1px solid var(--line);padding:16px 18px;background:#fcfcfd}
@media (max-width:900px){.eduf .rail{border-right:none;border-bottom:1px solid var(--line)}}
.eduf .body{padding:16px 18px;display:flex;flex-direction:column;gap:14px}

/* form fields */
.eduf .fld{margin-bottom:12px}
.eduf .fld:last-child{margin-bottom:0}
.eduf .fld > label{display:block;font-size:10px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;font-weight:700}
.eduf .fld input,.eduf .fld select,.eduf .fld textarea{width:100%}
.eduf .row{display:flex;gap:10px}
.eduf .row > .fld{flex:1;margin-bottom:0}
.eduf .toggle{display:flex;align-items:center;gap:9px;font-size:13px;cursor:pointer;user-select:none}
.eduf .toggle input{width:auto;margin:0;accent-color:var(--accent)}
.eduf .hint{font-size:11px;color:var(--muted);margin-top:3px}

/* bordered section blocks */
.eduf .sec{border:1px solid var(--border);border-radius:6px;background:#fff}
.eduf .sec > .sh{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:10px 13px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}
.eduf .sec > .sb{padding:13px}

/* photo block */
.eduf .photo{display:flex;flex-direction:column;gap:8px}
.eduf .photo .pv{width:100%;aspect-ratio:1/1;background:#eef1f8 center/cover no-repeat;border:1px solid var(--fieldborder);border-radius:var(--r);display:flex;align-items:center;justify-content:center;color:#9aa0ad;font-size:12px}
.eduf .photo .acts{display:flex;gap:8px}

/* relation tag box */
.eduf .relbox{border:1px solid var(--fieldborder);border-radius:var(--r);background:#fff;padding:8px}
.eduf .tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.eduf .tags:empty{margin-bottom:0}
.eduf .tag{display:inline-flex;align-items:center;gap:6px;background:var(--accent-soft);color:var(--accent);border:1px solid #cdd6f6;border-radius:var(--r);padding:4px 8px;font-size:12px;font-weight:600}
.eduf .tag .x{cursor:pointer;border:none;background:none;color:inherit;font-size:12px;padding:0;line-height:1;opacity:.7}
.eduf .tag .x:hover{opacity:1}
.eduf .relbox .addwrap{position:relative}
.eduf .relbox .addwrap input{width:100%}
.eduf .relmenu{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:30;background:#fff;border:1px solid var(--border);border-radius:var(--r);box-shadow:0 8px 24px rgba(0,0,0,.14);max-height:220px;overflow-y:auto}
.eduf .relmenu button{display:block;width:100%;text-align:left;font-family:inherit;font-size:12.5px;color:var(--ink);background:none;border:none;padding:8px 10px;cursor:pointer;border-bottom:1px solid #f0f1f4}
.eduf .relmenu button:last-child{border-bottom:none}
.eduf .relmenu button:hover{background:#f6f7f9}
.eduf .relmenu .none{padding:8px 10px;font-size:12px;color:var(--muted)}

/* json array (moves / hobbies) row-of-inputs, stacked full-width rows */
.eduf .chips{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.eduf .chipin{display:flex;align-items:center;gap:5px;width:100%;background:#fff;border:1px solid var(--fieldborder);border-radius:var(--r);padding:0 4px 0 8px}
.eduf .chipin input{flex:1;border:none;background:none;padding:7px 0;font-size:12.5px}
.eduf .chipin input:focus{outline:none}
.eduf .chipin .x{cursor:pointer;border:none;background:none;color:var(--danger);font-size:13px;padding:0 4px;line-height:1}
.eduf .addbtn{font-size:12px;color:var(--accent);border:1px solid #cdd6f6;background:var(--accent-soft);border-radius:var(--r);padding:6px 10px;cursor:pointer;font-family:inherit;font-weight:600}
.eduf .addbtn:hover{background:#e3e9fb}

/* segmented public/hidden control */
.eduf .pubseg{display:inline-flex;border:1px solid var(--fieldborder);border-radius:var(--r);overflow:hidden}
.eduf .pubseg button{font-family:inherit;font-size:12.5px;padding:7px 18px;border:none;background:#fff;color:var(--muted);cursor:pointer;border-right:1px solid var(--fieldborder)}
.eduf .pubseg button:last-child{border-right:none}
.eduf .pubseg button.on{background:var(--accent);color:#fff;font-weight:700}

/* gallery grid */
.eduf .gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}
.eduf .gal .gi{position:relative;aspect-ratio:1/1;border:1px solid var(--fieldborder);border-radius:var(--r);background:#eef1f8 center/cover no-repeat;overflow:hidden}
.eduf .gal .gi .x{position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:var(--r);border:none;background:rgba(255,255,255,.9);color:var(--danger);cursor:pointer;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center}
.eduf .gal .add{aspect-ratio:1/1;border:1px solid var(--fieldborder);border-radius:var(--r);background:#fafbff;color:var(--accent);cursor:pointer;font-size:22px;display:flex;align-items:center;justify-content:center;font-family:inherit}
.eduf .gal .add:hover{background:#eef1fb}

/* season block */
.eduf .season{border:1px solid var(--border);border-radius:6px;background:#fff;margin-bottom:12px}
.eduf .season .sthd{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--line)}
.eduf .season .sthd input{max-width:180px}
.eduf .season .sbody{padding:10px 12px}

/* mini table (programs / results) */
.eduf .mini{border-collapse:collapse;width:100%;font-size:12.5px}
.eduf .mini th{text-align:left;font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);font-weight:700;padding:5px 8px;border-bottom:1px solid var(--line)}
.eduf .mini td{padding:4px 8px;border-bottom:1px solid #f0f1f4;vertical-align:middle}
.eduf .mini td input,.eduf .mini td select{width:100%}
.eduf .mini td.act{width:1%;text-align:right}
.eduf .mini .rm{cursor:pointer;border:none;background:none;color:var(--danger);font-size:14px;padding:2px 6px;line-height:1}
.eduf .miniadd{margin-top:8px}

/* sticky action bar */
/* Informational notice with an action. Same family as .msg, accent-tinted,
   used to point at a setting that lives on another page. */
.eduf .notice{display:flex;align-items:center;gap:12px;font-size:12.5px;color:var(--ink);background:var(--accent-soft);border:1px solid #cdd6f6;border-radius:var(--r);padding:10px 12px}
.eduf .notice .ntx{flex:1;line-height:1.45}
.eduf .notice .ntx b{display:block;font-weight:700;margin-bottom:1px}
.eduf .notice .ntx span{color:var(--muted)}
.eduf .notice .ico{width:18px;height:18px;flex-shrink:0;border-radius:50%;background:var(--accent);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center}
.eduf .notice .btn{background:#fff;border-color:#cdd6f6;color:var(--accent)}
/* Read-only value row, for values the system computes rather than accepts. */
.eduf .ro{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted);background:var(--field);border:1px solid var(--line);border-radius:var(--r);padding:8px 10px}
.eduf .ro b{color:var(--ink);font-weight:700}
.eduf .pill{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ok);background:#e7f3ec;border:1px solid #bfe0cc;border-radius:var(--r);padding:2px 6px}
.eduf .pill.auto{color:var(--accent);background:var(--accent-soft);border-color:#cdd6f6}
.eduf .pa{display:flex;align-items:center;gap:10px;padding:13px 18px;border-top:1px solid var(--line);background:#fcfcfd;position:sticky;bottom:0}
.eduf .pa .grow{flex:1}
`;
