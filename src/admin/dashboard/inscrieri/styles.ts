/**
 * Înscrieri page CSS (cfg.extraCss: one global style tag, so the portaled confirm window gets it too).
 * Tokens only; every class ins- prefixed under .ui-root; written in plain strings (a backtick inside a
 * CSS template literal blanks the admin, see src/admin/ui/styles.ts).
 */
const LIST_CSS =
  '.ui-root .sbt-clist td{height:50px;padding-top:0;padding-bottom:0}' +
  '.ui-root .ins-nr{font-weight:700}' +
  '.ui-root .ins-name{line-height:1.2}' +
  '.ui-root .ins-name b{display:block}' +
  '.ui-root .ins-ex{display:flex;align-items:center;gap:5px;margin-top:1px;min-height:14px;font-size:11.5px;font-weight:600;color:var(--theme-info)}' +
  '.ui-root .ins-exf{display:inline-flex;align-items:center;gap:6px}' +
  '.ui-root .ins-schools{padding:0 18px;border-bottom:1px solid var(--theme-border)}' +
  '.ui-root .ins-back{padding:4px 18px 10px}';

const PANEL_CSS =
  '.ui-root .ins-panel{display:flex;flex-direction:column;min-width:0}' +
  '.ui-root .ins-ph{display:flex;flex-direction:column;gap:6px;padding:13px 15px 0}' +
  '.ui-root .ins-ph-top{display:flex;align-items:center;gap:8px}' +
  '.ui-root .ins-ph-name{flex:1;min-width:0;font-size:15px;color:var(--theme-text)}' +
  '.ui-root .ins-ph-meta{display:flex;flex-wrap:wrap;gap:14px;font-size:12.5px;color:var(--theme-text-secondary)}' +
  '.ui-root .ins-ph-meta b{color:var(--theme-text)}' +
  '.ui-root .ins-ph .sbt-statusbox{margin:4px 0 0}' +
  '.ui-root .ins-tabs{margin-top:10px;padding:0 15px}' +
  '.ui-root .ins-panel .sbt-pb{max-height:calc(100vh - 420px);min-height:240px}' +
  '.ui-root .ins-extra{margin-top:16px;padding-top:12px;border-top:1px solid var(--theme-border)}' +
  '.ui-root .ins-empty{margin:0;font-size:13px;color:var(--theme-text-muted)}' +
  '.ui-root .ins-his{display:flex;flex-direction:column;margin:0;padding:0;list-style:none}' +
  '.ui-root .ins-his li{display:flex;flex-direction:column;gap:2px;padding:8px 0;font-size:13px;color:var(--theme-text)}' +
  '.ui-root .ins-his li:first-child{padding-top:0}' +
  '.ui-root .ins-his li + li{border-top:1px solid var(--theme-border)}' +
  '.ui-root .ins-his-h{font-size:12.5px;font-weight:700;color:var(--theme-text)}' +
  '.ui-root .ins-foot{display:flex;flex-wrap:wrap;gap:8px;margin-left:auto}' +
  '.ui-root .ins-link{display:inline-flex;align-items:center;gap:4px;padding:0;border:0;background:none;font:inherit;font-size:12.5px;font-weight:600;color:var(--theme-primary);cursor:pointer}' +
  '.ui-root .ins-link:focus-visible{outline:2px solid var(--theme-focus);outline-offset:2px}' +
  '.ui-root .ins-link:disabled{opacity:.5;cursor:default}' +
  '.ui-root .ins-label-row{display:flex;align-items:center;justify-content:space-between;gap:8px}' +
  '.ui-root .ins-label-row .ins-link{text-transform:none;letter-spacing:0}' +
  '.ui-root.sbt-menu button.ins-danger{color:var(--theme-danger)}';

const MATCH_CSS =
  '.ui-root .ins-mcard{margin:10px 15px 0;border:1px solid var(--theme-border);border-radius:var(--ui-radius-md);background:var(--theme-surface)}' +
  '.ui-root .ins-mcard-top,.ui-root .ins-acard{display:flex;align-items:center;gap:10px;padding:10px 12px}' +
  '.ui-root .ins-av{flex:none;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--ui-radius-md);background:var(--theme-primary-soft);color:var(--theme-primary);font-size:13px;font-weight:700}' +
  '.ui-root .ins-acard-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:12.5px;color:var(--theme-text-secondary)}' +
  '.ui-root .ins-acard-t b{font-size:13.5px;color:var(--theme-text)}' +
  '.ui-root .ins-mcard-body{display:flex;flex-direction:column;padding:0 12px 10px;border-top:1px solid var(--theme-border)}' +
  '.ui-root .ins-cmp-wrap{overflow-x:auto}' +
  '.ui-root .ins-cmp{width:100%;border-collapse:collapse;font-size:12.5px}' +
  '.ui-root .ins-cmp th{padding:8px 6px;text-align:left;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--theme-text-muted)}' +
  '.ui-root .ins-cmp td{padding:7px 6px;border-top:1px solid var(--theme-border);vertical-align:top;color:var(--theme-text)}' +
  '.ui-root .ins-cmp tr.is-diff td{background:var(--theme-warning-bg)}' +
  '.ui-root .ins-right{align-self:flex-end;margin-top:8px}';

const EDIT_CSS =
  '.ui-root .ins-edit-h{margin:16px 0 8px;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--theme-text-muted)}' +
  '.ui-root .ins-edit-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}';

const CONFIRM_CSS =
  '.ui-root .ins-win{display:flex;flex-direction:column;gap:16px}' +
  '.ui-root .ins-sec{display:flex;flex-direction:column;gap:10px}' +
  '.ui-root .ins-sec + .ins-sec{padding-top:14px;border-top:1px solid var(--theme-border)}' +
  '.ui-root .ins-sec-h{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--theme-text-muted)}' +
  '.ui-root .ins-acard{border:1px solid var(--theme-border);border-radius:var(--ui-radius-md);background:var(--theme-surface)}' +
  '.ui-root .ins-hint2{display:block;margin-top:4px}' +
  '.ui-root .ins-links{display:flex;flex-wrap:wrap;gap:16px}' +
  '.ui-root .ins-win .ins-cmp{min-width:520px}' +
  '.ui-root .ins-note,.ui-root .ins-line,.ui-root .ins-intent,.ui-root .ins-acs p{margin:0;font-size:13px;color:var(--theme-text)}' +
  '.ui-root .ins-acs{display:flex;flex-direction:column;gap:4px}' +
  '.ui-root .ins-search-bar{display:flex;align-items:center;gap:10px}' +
  '.ui-root .ins-search-bar .ui-input{flex:1}' +
  '.ui-root .ins-res{margin:6px 0 0;padding:0;list-style:none;border:1px solid var(--theme-border);border-radius:var(--ui-radius-md);background:var(--theme-surface)}' +
  '.ui-root .ins-res li + li{border-top:1px solid var(--theme-border)}' +
  '.ui-root .ins-res button{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border:0;background:none;font:inherit;text-align:left;color:var(--theme-text);cursor:pointer}' +
  '.ui-root .ins-res button:hover,.ui-root .ins-res button:focus-visible{background:var(--theme-surface-subtle);outline:none}' +
  '.ui-root .ins-res-t{display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--theme-text-secondary)}' +
  '.ui-root .ins-res-t b{font-size:13.5px;color:var(--theme-text)}' +
  '.ui-root .ins-res-none{padding:10px 12px;font-size:13px;color:var(--theme-text-muted)}' +
  '.ui-root .ins-foot-hint{flex:1;align-self:center;font-size:12.5px;color:var(--theme-text-muted)}';

export const INSCRIERI_CSS = [LIST_CSS, PANEL_CSS, MATCH_CSS, EDIT_CSS, CONFIRM_CSS].join('\n');
