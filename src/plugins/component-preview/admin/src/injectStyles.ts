const injected = new Set<string>();

export function injectStyles(id: string, css: string) {
  if (injected.has(id) || document.getElementById(id)) return;
  injected.add(id);
  const el = document.createElement('style');
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
