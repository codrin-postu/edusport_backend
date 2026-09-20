'use strict';

/**
 * Import the legacy WordPress.com articles (scoaladepatinaj.com) into Strapi.
 *
 * What it does
 *   - reads the posts from the WordPress REST API (or a local JSON snapshot)
 *   - converts post HTML into Strapi "blocks" JSON (paragraph / heading / list /
 *     quote / image / link, with bold, italic, underline marks)
 *   - downloads every <img> from WordPress, uploads it into the Strapi media
 *     library through the upload plugin, and points the body image node and the
 *     coverImage at the uploaded file (never at wordpress.com)
 *   - pulls YouTube and Vimeo iframes into the `video` JSON field and leaves a
 *     visible link in the body where the embed used to be, because Strapi blocks
 *     has no embed node
 *   - keeps the original publication date in `date` and publishes the entry
 *
 * Idempotency: entries are matched on `slug`. An existing slug is reported and
 * left untouched, never overwritten or deleted. Uploaded files are matched on
 * file name so a re-run does not duplicate media either.
 *
 * Usage (local dev, container working dir is /app):
 *   docker exec strapi_app node scripts/import-wordpress-articles.js
 *   docker exec strapi_app node scripts/import-wordpress-articles.js --dry-run
 *
 * Usage (production). Note two things about this repo:
 *   1. the `npm run seed:*` entries in package.json hardcode `docker exec
 *      strapi_app`, which is the local dev container name and does not exist in
 *      production;
 *   2. the production image (Dockerfile.production) does not ship `scripts/`.
 *   So on the production VM the script has to be piped in from the host:
 *      docker exec -i -w /opt/app edusport_backend node - < scripts/import-wordpress-articles.js
 *   Piping through stdin means the script must stay dependency free: it uses
 *   only node builtins plus the Strapi runtime, no htmlparser2 / cheerio.
 *
 * Flags:
 *   --dry-run          convert and report, write nothing
 *   --snapshot=PATH    read posts from a local JSON file instead of the network
 *   --limit=N          only process the first N posts
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const WP_ENDPOINT =
  process.env.WP_ENDPOINT ||
  'https://public-api.wordpress.com/wp/v2/sites/scoaladepatinaj.com/posts?per_page=100&orderby=date&order=asc';

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const SNAPSHOT = (argv.find((a) => a.startsWith('--snapshot=')) || '').split('=')[1];
const LIMIT = Number((argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || 0;

// ─────────────────────────────────────────────────────────────────────────────
// HTML entities
// ─────────────────────────────────────────────────────────────────────────────

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', rarr: '→', larr: '←', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  laquo: '«', raquo: '»', bull: '•', middot: '·',
  deg: '°', copy: '©', reg: '®', trade: '™',
  euro: '€', times: '×', shy: '', zwj: '', zwnj: '',
};

function decodeEntities(input) {
  if (!input) return '';
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      // WordPress emits &#038; for a literal ampersand inside attributes.
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    const named = NAMED_ENTITIES[body];
    return named === undefined ? whole : named;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal dependency free HTML parser
//
// The legacy content is small and regular (p, div, figure, span, a, strong, em,
// u, br, img, iframe, ol/ul/li, hr) but it is not always well formed: several
// posts end with an unclosed <p>. The parser therefore auto-closes tags on an
// implied close and at end of input, the way a browser would.
// ─────────────────────────────────────────────────────────────────────────────

const VOID_TAGS = new Set([
  'br', 'img', 'hr', 'input', 'meta', 'link', 'source', 'col', 'area', 'base', 'wbr',
]);

// Opening one of these implicitly closes an open element of the same kind.
const IMPLIED_CLOSE = {
  p: new Set(['p']),
  li: new Set(['li']),
  div: new Set(['p']),
  figure: new Set(['p']),
  ul: new Set(['p']),
  ol: new Set(['p']),
  blockquote: new Set(['p']),
  h1: new Set(['p']), h2: new Set(['p']), h3: new Set(['p']),
  h4: new Set(['p']), h5: new Set(['p']), h6: new Set(['p']),
};

function parseAttributes(raw) {
  const attrs = {};
  const re = /([a-zA-Z_:@.\-][a-zA-Z0-9_:.\-]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const name = m[1].toLowerCase();
    const value = m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5] !== undefined ? m[5] : '';
    attrs[name] = decodeEntities(value);
  }
  return attrs;
}

/** Parse an HTML fragment into a tree of {type:'tag'|'text'} nodes. */
function parseHtml(html) {
  const root = { type: 'tag', name: '#root', attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];

  // Drop comments, scripts, styles and CDATA outright.
  const src = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let cursor = 0;
  let m;

  const pushText = (raw) => {
    if (!raw) return;
    const text = decodeEntities(raw);
    if (text) top().children.push({ type: 'text', text });
  };

  while ((m = tagRe.exec(src)) !== null) {
    pushText(src.slice(cursor, m.index));
    cursor = tagRe.lastIndex;

    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    const rawAttrs = m[3] || '';

    if (closing) {
      // Pop until the matching open tag. Ignore strays.
      const idx = stack.map((n) => n.name).lastIndexOf(name);
      if (idx > 0) stack.length = idx;
      continue;
    }

    const implied = IMPLIED_CLOSE[name];
    if (implied) {
      while (stack.length > 1 && implied.has(top().name)) stack.pop();
    }

    const node = { type: 'tag', name, attrs: parseAttributes(rawAttrs), children: [] };
    top().children.push(node);

    const selfClosing = /\/\s*$/.test(rawAttrs);
    if (!VOID_TAGS.has(name) && !selfClosing) stack.push(node);
  }
  pushText(src.slice(cursor));

  return root;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML tree to Strapi blocks
// ─────────────────────────────────────────────────────────────────────────────

const BLOCK_TAGS = new Set([
  'p', 'div', 'figure', 'figcaption', 'blockquote', 'ul', 'ol', 'li', 'hr', 'table',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'header', 'footer',
]);

const MARK_TAGS = {
  strong: 'bold', b: 'bold',
  em: 'italic', i: 'italic',
  u: 'underline', ins: 'underline',
  s: 'strikethrough', strike: 'strikethrough', del: 'strikethrough',
  code: 'code', tt: 'code',
};

function isBlank(str) {
  return !str || !str.replace(/[\s ]+/g, '').length;
}

function textNode(text, marks) {
  return { type: 'text', text, ...(marks || {}) };
}

/** Collapse runs of spaces but keep the explicit newlines <br> produced. */
function normalizeSpace(str) {
  return str.replace(/[^\S\n]+/g, ' ');
}

function childrenHaveContent(children) {
  return children.some((c) => {
    if (c.type === 'text') return !isBlank(c.text);
    if (c.type === 'link') return true;
    return true;
  });
}

/**
 * Convert a parsed HTML tree into Strapi blocks.
 *
 * `ctx` supplies the side channels the blocks format cannot express:
 *   ctx.resolveImage(src, alt)  -> uploaded file object, or null when the source
 *                                  image could not be retrieved
 *   ctx.onEmbed(url)            -> records an iframe; returns the label to show
 */
function htmlToBlocks(html, ctx) {
  const root = parseHtml(html);
  const out = [];
  walkBlockContainer(root.children, out, ctx, {});
  return tidyBlocks(out);
}

function walkBlockContainer(children, out, ctx, marks) {
  let inline = [];

  const flush = () => {
    const trimmed = trimInline(inline);
    inline = [];
    if (trimmed.length && childrenHaveContent(trimmed)) {
      out.push({ type: 'paragraph', children: trimmed });
    }
  };

  for (const child of children) {
    if (child.type === 'text') {
      inline.push(textNode(normalizeSpace(child.text), marks));
      continue;
    }

    const name = child.name;

    if (name === 'br') {
      inline.push(textNode('\n', marks));
      continue;
    }

    if (name === 'img') {
      flush();
      emitImage(child, null, out, ctx);
      continue;
    }

    if (name === 'iframe') {
      flush();
      emitEmbed(child.attrs.src, out, ctx);
      continue;
    }

    if (name === 'a') {
      // An anchor that only wraps an image is a lightbox link, not prose.
      const imgs = collectTags(child, 'img');
      if (imgs.length) {
        flush();
        for (const img of imgs) emitImage(img, child.attrs.href, out, ctx);
        continue;
      }
      const link = buildLink(child, ctx, marks);
      if (link) inline.push(link);
      continue;
    }

    if (MARK_TAGS[name]) {
      const nextMarks = { ...marks, [MARK_TAGS[name]]: true };
      // A mark wrapper may still contain block level content in this source.
      if (hasBlockDescendant(child)) {
        flush();
        walkBlockContainer(child.children, out, ctx, nextMarks);
      } else {
        inline.push(...inlineFrom(child.children, ctx, nextMarks));
      }
      continue;
    }

    if (name === 'span' || name === 'font' || name === 'small' || name === 'label') {
      // Span and font carry no meaning in blocks: keep the text, drop the wrapper.
      if (hasBlockDescendant(child)) {
        flush();
        walkBlockContainer(child.children, out, ctx, marks);
      } else {
        inline.push(...inlineFrom(child.children, ctx, marks));
      }
      continue;
    }

    if (BLOCK_TAGS.has(name)) {
      flush();
      emitBlockElement(child, out, ctx, marks);
      continue;
    }

    // Anything unrecognised: keep the text, drop the wrapper.
    if (hasBlockDescendant(child)) {
      flush();
      walkBlockContainer(child.children, out, ctx, marks);
    } else {
      inline.push(...inlineFrom(child.children, ctx, marks));
    }
  }

  flush();
}

function emitBlockElement(node, out, ctx, marks) {
  const name = node.name;

  if (name === 'hr') return; // blocks has no divider node

  if (/^h[1-6]$/.test(name)) {
    const children = trimInline(inlineFrom(node.children, ctx, marks));
    if (children.length && childrenHaveContent(children)) {
      out.push({ type: 'heading', level: Number(name[1]), children });
    }
    return;
  }

  if (name === 'ul' || name === 'ol') {
    const items = [];
    for (const li of node.children) {
      if (li.type !== 'tag' || li.name !== 'li') continue;
      const children = trimInline(inlineFrom(li.children, ctx, marks));
      if (children.length && childrenHaveContent(children)) {
        items.push({ type: 'list-item', children });
      }
      // Images and embeds nested inside a list item are hoisted out below it.
      const extra = [];
      for (const img of collectTags(li, 'img')) emitImage(img, null, extra, ctx);
      for (const f of collectTags(li, 'iframe')) emitEmbed(f.attrs.src, extra, ctx);
      if (extra.length) {
        if (items.length) {
          out.push({ type: 'list', format: name === 'ol' ? 'ordered' : 'unordered', children: items.splice(0) });
        }
        out.push(...extra);
      }
    }
    if (items.length) {
      out.push({ type: 'list', format: name === 'ol' ? 'ordered' : 'unordered', children: items });
    }
    return;
  }

  if (name === 'blockquote') {
    const inner = [];
    walkBlockContainer(node.children, inner, ctx, marks);
    const flat = [];
    for (const b of inner) {
      if (b.type === 'paragraph') {
        if (flat.length) flat.push(textNode('\n'));
        flat.push(...b.children);
      } else {
        // Non text content inside a quote is emitted after it.
        out.push(b);
      }
    }
    if (flat.length && childrenHaveContent(flat)) {
      out.push({ type: 'quote', children: flat });
    }
    return;
  }

  if (name === 'table') {
    // Blocks has no table node. Emit each row as a paragraph so the data stays.
    const rows = collectTags(node, 'tr');
    for (const tr of rows) {
      const cells = [...collectTags(tr, 'td'), ...collectTags(tr, 'th')];
      const line = cells
        .map((c) => trimInline(inlineFrom(c.children, ctx, marks)).map((t) => t.text || '').join(''))
        .filter((t) => !isBlank(t))
        .join(' | ');
      if (!isBlank(line)) out.push({ type: 'paragraph', children: [textNode(line)] });
    }
    return;
  }

  // p, div, figure, figcaption, li outside a list, section, article, header, footer
  walkBlockContainer(node.children, out, ctx, marks);
}

// The old site is the base for the handful of relative hrefs in the archive.
const LEGACY_SITE = 'https://scoaladepatinaj.com/';

/**
 * Strapi's blocks validator rejects any url that `new URL()` cannot parse, so
 * relative hrefs such as "../" are resolved against the old site and anything
 * still unparseable is refused here rather than failing the whole import.
 */
function safeUrl(href) {
  const raw = (href || '').trim();
  if (!raw || raw.startsWith('#')) return null;
  try {
    new URL(raw.startsWith('/') ? `https://strapi.io${raw}` : raw);
    return raw;
  } catch {
    try {
      return new URL(raw, LEGACY_SITE).toString();
    } catch {
      return null;
    }
  }
}

function buildLink(node, ctx, marks) {
  const url = safeUrl(node.attrs.href);
  const children = trimInline(inlineFrom(node.children, ctx, marks));
  if (!children.length || !childrenHaveContent(children)) return null;
  if (!url) {
    // An anchor without a usable target degrades to plain text.
    return children.length === 1 ? children[0] : { type: 'text', text: children.map((c) => c.text).join('') };
  }
  return { type: 'link', url, children: children.map((c) => (c.type === 'text' ? c : textNode(c.text || ''))) };
}

function inlineFrom(children, ctx, marks) {
  const nodes = [];
  for (const child of children) {
    if (child.type === 'text') {
      nodes.push(textNode(normalizeSpace(child.text), marks));
      continue;
    }
    if (child.name === 'br') {
      nodes.push(textNode('\n', marks));
      continue;
    }
    if (child.name === 'img' || child.name === 'iframe') continue; // handled at block level
    if (child.name === 'a') {
      const link = buildLink(child, ctx, marks);
      if (link) nodes.push(link);
      continue;
    }
    if (MARK_TAGS[child.name]) {
      nodes.push(...inlineFrom(child.children, ctx, { ...marks, [MARK_TAGS[child.name]]: true }));
      continue;
    }
    nodes.push(...inlineFrom(child.children, ctx, marks));
  }
  return mergeAdjacentText(nodes);
}

function mergeAdjacentText(nodes) {
  const out = [];
  for (const n of nodes) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.type === 'text' &&
      n.type === 'text' &&
      !!prev.bold === !!n.bold &&
      !!prev.italic === !!n.italic &&
      !!prev.underline === !!n.underline &&
      !!prev.strikethrough === !!n.strikethrough &&
      !!prev.code === !!n.code
    ) {
      prev.text += n.text;
    } else {
      out.push({ ...n });
    }
  }
  return out;
}

function trimInline(nodes) {
  const merged = mergeAdjacentText(nodes).filter(
    (n) => n.type !== 'text' || n.text.length > 0,
  );
  if (merged.length && merged[0].type === 'text') {
    merged[0] = { ...merged[0], text: merged[0].text.replace(/^[\s ]+/, '') };
  }
  const last = merged.length - 1;
  if (last >= 0 && merged[last].type === 'text') {
    merged[last] = { ...merged[last], text: merged[last].text.replace(/[\s ]+$/, '') };
  }
  return merged.filter((n) => n.type !== 'text' || n.text.length > 0);
}

function hasBlockDescendant(node) {
  for (const c of node.children || []) {
    if (c.type !== 'tag') continue;
    if (BLOCK_TAGS.has(c.name) || c.name === 'img' || c.name === 'iframe') return true;
    if (hasBlockDescendant(c)) return true;
  }
  return false;
}

function collectTags(node, name) {
  const found = [];
  const visit = (n) => {
    for (const c of n.children || []) {
      if (c.type !== 'tag') continue;
      if (c.name === name) found.push(c);
      visit(c);
    }
  };
  visit(node);
  return found;
}

function emitImage(imgNode, href, out, ctx) {
  const src = imgNode.attrs['data-orig-file'] || imgNode.attrs.src;
  if (!src) return;
  const alt = (imgNode.attrs.alt || '').trim();
  const file = ctx.resolveImage(src, alt);

  const linkHref = safeUrl(href);

  if (file) {
    out.push({ type: 'image', image: file, children: [textNode('')] });
    // Keep an anchor that pointed somewhere other than the image itself.
    if (linkHref && !/\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(linkHref)) {
      out.push({
        type: 'paragraph',
        children: [{ type: 'link', url: linkHref, children: [textNode('Link asociat imaginii')] }],
      });
    }
    return;
  }

  // The original image is no longer reachable. Say so rather than drop it.
  const fallbackHref = linkHref || safeUrl(src);
  out.push({
    type: 'paragraph',
    children: fallbackHref
      ? [
          textNode('Imagine indisponibila in arhiva originala: '),
          { type: 'link', url: fallbackHref, children: [textNode(alt || src)] },
        ]
      : [textNode(`Imagine indisponibila in arhiva originala: ${alt || src}`)],
  });
}

/**
 * Strapi's blocks validator requires an exact set of file fields on an image
 * node, with createdAt/updatedAt as strings. The upload service returns Date
 * objects and extra keys, so normalise before embedding the file in the body.
 */
function toBlockImage(file) {
  if (!file) return null;
  const iso = (v) => (v instanceof Date ? v.toISOString() : v ? String(v) : new Date().toISOString());
  return {
    id: file.id,
    name: file.name,
    alternativeText: file.alternativeText ?? null,
    caption: file.caption ?? null,
    url: file.url,
    width: file.width ?? 0,
    height: file.height ?? 0,
    formats: file.formats ?? null,
    hash: file.hash,
    ext: file.ext,
    mime: file.mime,
    size: file.size,
    previewUrl: file.previewUrl ?? null,
    provider: file.provider,
    provider_metadata: file.provider_metadata ?? null,
    createdAt: iso(file.createdAt),
    updatedAt: iso(file.updatedAt),
  };
}

function emitEmbed(rawSrc, out, ctx) {
  if (!rawSrc) return;
  const url = decodeEntities(rawSrc).trim();
  if (!url) return;
  const label = ctx.onEmbed(url);
  if (!label) return;
  const target = safeUrl(label.url);
  out.push({
    type: 'paragraph',
    children: target
      ? [{ type: 'link', url: target, children: [textNode(label.text)] }]
      : [textNode(`${label.text}: ${label.url}`)],
  });
}

/** Drop empty leading/trailing paragraphs and collapse repeated blank ones. */
function tidyBlocks(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.type === 'paragraph') {
      const hasText = b.children.some(
        (c) => (c.type === 'link' && c.children.length) || (c.type === 'text' && !isBlank(c.text)),
      );
      if (!hasText) continue;
      b.children = b.children.map((c) =>
        c.type === 'text' ? { ...c, text: c.text.replace(/ /g, ' ') } : c,
      );
    }
    out.push(b);
  }
  return out.length ? out : [{ type: 'paragraph', children: [textNode('')] }];
}

// ─────────────────────────────────────────────────────────────────────────────
// Video embeds
// ─────────────────────────────────────────────────────────────────────────────

/** Return {provider, id, watchUrl} for YouTube/Vimeo, otherwise null. */
function parseVideoUrl(url) {
  let parsed;
  try {
    parsed = new URL(url, 'https://example.invalid');
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();

  if (host === 'youtu.be') {
    const id = parsed.pathname.replace(/^\//, '').split('/')[0];
    if (id) return { provider: 'youtube', id, watchUrl: `https://www.youtube.com/watch?v=${id}` };
  }
  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    const v = parsed.searchParams.get('v');
    if (v) return { provider: 'youtube', id: v, watchUrl: `https://www.youtube.com/watch?v=${v}` };
    const m = parsed.pathname.match(/^\/(embed|shorts|v)\/([\w-]+)/);
    if (m) return { provider: 'youtube', id: m[2], watchUrl: `https://www.youtube.com/watch?v=${m[2]}` };
  }
  if (host.endsWith('vimeo.com')) {
    const id = parsed.pathname.replace(/^\//, '').split('/').filter(Boolean).pop();
    if (id && /^\d+$/.test(id)) {
      return { provider: 'vimeo', id, watchUrl: `https://vimeo.com/${id}` };
    }
  }
  return null;
}

function embedLabel(url) {
  const video = parseVideoUrl(url);
  if (video) {
    return {
      url: video.watchUrl,
      text: video.provider === 'vimeo' ? 'Vezi materialul video pe Vimeo' : 'Vezi materialul video pe YouTube',
    };
  }
  if (/docs\.google\.com\/forms/.test(url)) {
    return { url: url.replace(/[?&]embedded=true/, ''), text: 'Deschide formularul de inscriere' };
  }
  if (/facebook\.com/.test(url)) return { url, text: 'Vezi postarea pe Facebook' };
  return { url, text: 'Deschide continutul incorporat' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Category mapping
//
// WordPress only ever used two real categories on these posts:
//   23673 NOUTATI (34 posts) and 412 VIDEO (8 posts).
// Neither maps onto the Strapi enum, so the category is decided from the title
// and slug, defaulting to `general`. The resolved mapping is printed at the end
// of the run so it can be checked post by post.
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_RULES = [
  [/cupa|trophy|campionat|concurs|competit|program liber|frp/i, 'competitii'],
  [/serbare|spectacol|demonstrat|halloween|craciun|aristocats/i, 'evenimente'],
  [
    /inscrier|inscriti|program|modul|cursuri|curs |vacanta|nu se fac|revedem|atentia|redeschide|rezervare|reincep|incep|anulare|compensare|formular/i,
    'anunturi',
  ],
];

function mapCategory(post) {
  const haystack = `${decodeEntities(post.title.rendered)} ${post.slug}`;
  for (const [re, category] of CATEGORY_RULES) {
    if (re.test(haystack)) return category;
  }
  return 'general';
}

// ─────────────────────────────────────────────────────────────────────────────
// Text helpers
// ─────────────────────────────────────────────────────────────────────────────

function cleanTitle(raw) {
  return decodeEntities(raw).replace(/[\s ]+/g, ' ').trim();
}

function stripTags(html) {
  return decodeEntities(String(html || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * `description` is varchar(255) in Postgres, so cut on a word boundary.
 * It is built from the original prose, not from the converted blocks, so the
 * synthetic "Vezi materialul video" link labels never leak into the summary.
 * Posts whose whole content was an embed simply get no description.
 */
function buildDescription(post) {
  const fromExcerpt = stripTags(post.excerpt?.rendered || '')
    .replace(/\s*Continue reading.*$/i, '')
    .trim();
  const source = fromExcerpt || stripTags(post.content?.rendered || '');
  if (!source) return null;
  if (source.length <= 250) return source;
  const cut = source.slice(0, 250);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 120 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, '')}...`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Media
// ─────────────────────────────────────────────────────────────────────────────

const EXT_BY_MIME = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
  'image/webp': '.webp', 'image/avif': '.avif', 'image/svg+xml': '.svg',
};

/** WordPress appends ?w=&h= resize params. Ask for the original file instead. */
function canonicalImageUrl(raw) {
  try {
    const u = new URL(raw);
    if (/wordpress\.com$|scoaladepatinaj\.com$|\.files\.wordpress\.com$/.test(u.hostname) && u.pathname.includes('/wp-content/')) {
      u.search = '';
    }
    return u.toString();
  } catch {
    return raw;
  }
}

function fileNameFor(url, contentType) {
  let base;
  try {
    base = path.basename(new URL(url).pathname) || 'imagine';
  } catch {
    base = 'imagine';
  }
  base = decodeURIComponent(base).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  let ext = path.extname(base);
  if (!ext && contentType) {
    ext = EXT_BY_MIME[contentType.split(';')[0].trim()] || '';
    base += ext;
  }
  return `wp-${base || 'imagine.jpg'}`;
}

async function downloadImage(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; EduSportImporter/1.0)',
      Accept: 'image/*,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw new Error(`not an image (${contentType || 'unknown type'})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length) throw new Error('empty response');
  return { buffer, contentType };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function loadPosts() {
  if (SNAPSHOT) {
    return JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  }
  const res = await fetch(WP_ENDPOINT, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`WordPress API returned HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const posts = await loadPosts();
  const selected = LIMIT ? posts.slice(0, LIMIT) : posts;
  console.log(`\nSursa: ${SNAPSHOT || WP_ENDPOINT}`);
  console.log(`Articole gasite in WordPress: ${posts.length}\n`);

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  const stats = {
    created: [],
    skipped: [],
    imagesUploaded: 0,
    imagesReused: 0,
    imagesFailed: [],
    videos: [],
    otherEmbeds: [],
  };

  // wpUrl -> uploaded file object (or null once a download is known to fail)
  const mediaCache = new Map();

  async function ensureUploaded(rawSrc) {
    const url = canonicalImageUrl(decodeEntities(rawSrc));
    if (mediaCache.has(url)) return mediaCache.get(url);

    let result = null;
    try {
      const { buffer, contentType } = await downloadImage(url);
      const name = fileNameFor(url, contentType);

      const existing = await strapi.db.query('plugin::upload.file').findOne({ where: { name } });
      if (existing) {
        stats.imagesReused += 1;
        result = existing;
      } else if (DRY_RUN) {
        result = { id: 0, name, url: `/uploads/${name}`, mime: contentType, alternativeText: null };
      } else {
        const tmp = path.join(os.tmpdir(), `${Date.now()}-${name}`);
        fs.writeFileSync(tmp, buffer);
        try {
          const [file] = await strapi
            .plugin('upload')
            .service('upload')
            .upload({
              files: {
                filepath: tmp,
                originalFileName: name,
                size: buffer.length,
                mimetype: contentType.split(';')[0].trim(),
              },
              data: { fileInfo: { name, alternativeText: null, caption: null } },
            });
          stats.imagesUploaded += 1;
          result = file;
        } finally {
          fs.rmSync(tmp, { force: true });
        }
      }
    } catch (err) {
      stats.imagesFailed.push({ url, reason: err.message });
      result = null;
    }

    mediaCache.set(url, result);
    return result;
  }

  for (const post of selected) {
    const slug = post.slug;
    const title = cleanTitle(post.title.rendered);
    const html = post.content?.rendered || '';

    const existing = await strapi.db.query('api::article.article').findOne({ where: { slug } });
    if (existing) {
      stats.skipped.push({ slug, title, id: existing.id });
      console.log(`  = exista deja, nu se modifica: ${slug}`);
      continue;
    }

    // Pre-resolve every image so the blocks conversion can stay synchronous.
    const imgSrcs = collectTags(parseHtml(html), 'img')
      .map((n) => n.attrs['data-orig-file'] || n.attrs.src)
      .filter(Boolean);
    for (const src of imgSrcs) await ensureUploaded(src);

    const embeds = [];
    const ctx = {
      resolveImage: (src) => toBlockImage(mediaCache.get(canonicalImageUrl(decodeEntities(src)))),
      onEmbed: (url) => {
        embeds.push(url);
        return embedLabel(url);
      },
    };

    const body = htmlToBlocks(html, ctx);

    const videoUrls = embeds.map(parseVideoUrl).filter(Boolean);
    const nonVideoEmbeds = embeds.filter((u) => !parseVideoUrl(u));
    for (const v of videoUrls) stats.videos.push({ slug, url: v.watchUrl });
    for (const u of nonVideoEmbeds) stats.otherEmbeds.push({ slug, url: u });

    // None of the 42 posts has a WordPress featured image, so the cover comes
    // from the body. Prefer the first reasonably large image: the first image
    // in a post is sometimes a small inline asset (a QR code, an icon) that
    // makes a poor hero.
    const postImages = imgSrcs
      .map((src) => mediaCache.get(canonicalImageUrl(decodeEntities(src))))
      .filter(Boolean);
    const firstImage =
      postImages.find((f) => (f.width || 0) * (f.height || 0) >= 100000) || postImages[0];

    const data = {
      title,
      slug,
      description: buildDescription(post),
      body,
      category: mapCategory(post),
      date: post.date.slice(0, 10),
      video: videoUrls.length ? { mode: 'url', url: videoUrls[0].watchUrl } : null,
      coverImage: firstImage ? firstImage.id : null,
    };

    if (DRY_RUN) {
      stats.created.push({ ...data, blocks: body.length });
      console.log(`  + (dry-run) ${data.date}  ${data.category.padEnd(11)} ${slug}`);
      continue;
    }

    const doc = await strapi.documents('api::article.article').create({
      data,
      status: 'published',
    });

    // The document service stamps publishedAt with "now". Restore the original
    // WordPress publication timestamp on the published row only, so the draft
    // row keeps publishedAt NULL and the entry stays published.
    const publishedAt = new Date(`${post.date_gmt}Z`);
    await strapi.db.connection('articles')
      .where({ document_id: doc.documentId })
      .whereNotNull('published_at')
      .update({ published_at: publishedAt, created_at: publishedAt });

    stats.created.push({ ...data, documentId: doc.documentId, blocks: body.length });
    console.log(`  + ${data.date}  ${data.category.padEnd(11)} ${slug}`);
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log('\n─── Rezumat ───────────────────────────────────────────────');
  console.log(`Articole importate : ${stats.created.length}`);
  console.log(`Articole sarite    : ${stats.skipped.length}`);
  console.log(`Imagini incarcate  : ${stats.imagesUploaded} (refolosite: ${stats.imagesReused})`);
  console.log(`Imagini esuate     : ${stats.imagesFailed.length}`);
  console.log(`Videoclipuri       : ${stats.videos.length}`);
  console.log(`Alte incorporari   : ${stats.otherEmbeds.length}`);

  if (stats.skipped.length) {
    console.log('\nSlug-uri deja existente (neatinse):');
    for (const s of stats.skipped) console.log(`  ${s.slug} (id ${s.id})`);
  }
  if (stats.imagesFailed.length) {
    console.log('\nImagini care nu au putut fi descarcate:');
    for (const f of stats.imagesFailed) console.log(`  ${f.reason}  ${f.url}`);
  }

  console.log('\nLista importata (date | title | category):');
  for (const a of stats.created) console.log(`  ${a.date} | ${a.title} | ${a.category}`);

  console.log('\nVideoclipuri capturate (slug -> url):');
  for (const v of stats.videos) console.log(`  ${v.slug} -> ${v.url}`);

  if (stats.otherEmbeds.length) {
    console.log('\nIncorporari care nu sunt video (pastrate ca link in body):');
    for (const e of stats.otherEmbeds) console.log(`  ${e.slug} -> ${e.url}`);
  }

  await app.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('\nImportul a esuat:', err);
  process.exit(1);
});
