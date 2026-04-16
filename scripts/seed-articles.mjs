/**
 * Seed script — imports all mock articles into Strapi via REST API.
 * Run from the edusport_backend directory:
 *   node scripts/seed-articles.mjs
 */

const STRAPI_URL = "http://localhost:1337";
const TOKEN =
  "31c9d4207e4cdb4274decb2ef7c666a7ae44d61f849180395125da8827a321b1da61b8dd864076351b001031dba8d0e7b25692b8b99052e99a017b0d199e0b9c4b70452dc5c2df729d5cd840f7c13388a74519f5ffde36a6e7929f45aca1c5c9e14ae641b2b4217232b07e345cfb31dd91059f99026afb4b23edb00b914c8800";

// ---------------------------------------------------------------------------
// Minimal HTML → Strapi Blocks converter
// Handles: h2, h3, p, ul/li, ol/li, blockquote (strips tables)
// ---------------------------------------------------------------------------

function text(t, mods = {}) {
  return { type: "text", text: t, ...mods };
}

function parseInline(html) {
  // Very small inline parser for bold/italic
  const nodes = [];
  const re = /<strong>(.*?)<\/strong>|<em>(.*?)<\/em>|<b>(.*?)<\/b>|([^<]+)/gs;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1] !== undefined) nodes.push(text(m[1], { bold: true }));
    else if (m[2] !== undefined) nodes.push(text(m[2], { italic: true }));
    else if (m[3] !== undefined) nodes.push(text(m[3], { bold: true }));
    else if (m[4]) nodes.push(text(m[4]));
  }
  return nodes.length ? nodes : [text("")];
}

function htmlToBlocks(html) {
  const blocks = [];

  // Normalize: collapse whitespace between tags
  const clean = html.replace(/\s*\n\s*/g, "").trim();

  // Strip tables entirely (not supported in Strapi Blocks simply)
  const noTables = clean.replace(/<table[\s\S]*?<\/table>/gi, "");

  // Tokenize top-level tags
  const re =
    /<(h[1-6]|p|ul|ol|blockquote)(?:[^>]*)>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(noTables)) !== null) {
    const tag = m[1].toLowerCase();
    const inner = m[2];

    if (tag === "p") {
      const children = parseInline(inner.replace(/<[^>]+>/g, ""));
      if (children.some((c) => c.text.trim())) {
        blocks.push({ type: "paragraph", children });
      }
    } else if (tag === "h2") {
      blocks.push({ type: "heading", level: 2, children: [text(inner.replace(/<[^>]+>/g, "").trim())] });
    } else if (tag === "h3") {
      blocks.push({ type: "heading", level: 3, children: [text(inner.replace(/<[^>]+>/g, "").trim())] });
    } else if (tag === "h4") {
      blocks.push({ type: "heading", level: 4, children: [text(inner.replace(/<[^>]+>/g, "").trim())] });
    } else if (tag === "ul" || tag === "ol") {
      const liRe = /<li(?:[^>]*)>([\s\S]*?)<\/li>/gi;
      let li;
      const items = [];
      while ((li = liRe.exec(inner)) !== null) {
        items.push({
          type: "list-item",
          children: parseInline(li[1].replace(/<[^>]+>/g, "")),
        });
      }
      if (items.length) {
        blocks.push({ type: "list", format: tag === "ol" ? "ordered" : "unordered", children: items });
      }
    } else if (tag === "blockquote") {
      const stripped = inner.replace(/<[^>]+>/g, "").trim();
      // Strapi Blocks quote requires direct text/inline children (no nested paragraph)
      blocks.push({ type: "quote", children: [text(stripped)] });
    }
  }

  // Fallback: if nothing parsed, wrap entire text as a paragraph
  if (blocks.length === 0) {
    const stripped = noTables.replace(/<[^>]+>/g, "").trim();
    if (stripped) {
      blocks.push({ type: "paragraph", children: [text(stripped)] });
    }
  }

  return blocks;
}

function plainTextToBlocks(body) {
  // Plain text with \n\n paragraphs (used in events mock data)
  return body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ type: "paragraph", children: [text(p)] }));
}

// ---------------------------------------------------------------------------
// Article data
// ---------------------------------------------------------------------------

const ARTICLES = [
  {
    slug: "campionatul-national-2025",
    title: "Campionatul Național de Patinaj Artistic 2025",
    description:
      "Sportivii noștri au obținut rezultate excepționale la Campionatul Național, demonstrând calitatea antrenamentelor și dedicarea echipei.",
    date: "2025-11-15",
    category: "competitii",
    bodyHtml: `<h2>Rezultate remarcabile pentru EduSport</h2>
<p>Sportivii Școlii de Patinaj EduSport au participat la Campionatul Național de Patinaj Artistic 2025, desfășurat în perioada 12-15 noiembrie la Patinoarul Olimpic din București.</p>
<p>Echipa noastră a obținut <strong>3 medalii de aur</strong>, <strong>2 de argint</strong> și <strong>4 de bronz</strong>, confirmând încă o dată calitatea programului de antrenament și dedicarea instructorilor.</p>
<p>Felicitări tuturor sportivilor și antrenorilor pentru rezultatele obținute!</p>
<blockquote><p>„Aceste rezultate sunt rodul muncii de echipă și al pasiunii pentru patinaj." — Antrenor Principal</p></blockquote>`,
  },
  {
    slug: "inscrieri-sezon-2025-2026",
    title: "Înscrierile pentru sezonul 2025-2026 sunt deschise!",
    description:
      "Înscrie-te acum la cursurile de patinaj artistic pentru noul sezon. Locuri limitate pentru toate grupele de vârstă.",
    date: "2025-10-01",
    category: "anunturi",
    bodyHtml: `<h2>Noul sezon începe în curând!</h2>
<p>Suntem bucuroși să anunțăm că înscrierile pentru sezonul 2025-2026 sunt oficial deschise. Cursurile vor începe pe 15 octombrie și se vor desfășura la Patinoarul Cotroceni On Ice.</p>
<h3>Grupe disponibile</h3>
<ul>
<li><strong>Primii Pași</strong> — pentru copii de 3-5 ani, fără experiență anterioară</li>
<li><strong>Începători</strong> — pentru copii de 5-8 ani</li>
<li><strong>Intermediari</strong> — pentru cei cu minim 1 an experiență</li>
<li><strong>Avansați</strong> — program de performanță</li>
</ul>
<p>Locurile sunt limitate, iar înscrierea se face pe principiul „primul venit, primul servit".</p>`,
  },
  {
    slug: "echipament-patinaj-ghid-parinti",
    title: "Echipamentul de patinaj — ghid complet pentru părinți",
    description:
      "Tot ce trebuie să știi despre alegerea patinelor, protecțiilor și îmbrăcămintei potrivite pentru primele lecții.",
    date: "2025-09-20",
    category: "tips",
    bodyHtml: `<h2>Cum alegi echipamentul potrivit</h2>
<p>Alegerea echipamentului corect este esențială pentru confortul și siguranța copilului pe gheață. Iată un ghid complet pentru părinți.</p>
<h3>Patinele</h3>
<p>Patinele de patinaj artistic diferă de cele de hochei sau de cele recreaționale. Ele au lama mai lungă și cu dinți la vârf, necesari pentru sărituri și piruete.</p>
<h3>Protecții recomandate</h3>
<ul>
<li>Cască — obligatoriu pentru începători</li>
<li>Genunchiere — recomandat pentru toți</li>
<li>Mănuși — obligatoriu pentru toți</li>
<li>Protecție șold — recomandat pentru avansați</li>
</ul>
<p>Vă recomandăm să consultați instructorii înainte de a achiziționa echipament scump.</p>`,
  },
  {
    slug: "spectacol-craciun-2025",
    title: "Spectacolul de Crăciun 2025 — Pregătiri în toi",
    description:
      "Pregătirile pentru spectacolul anual de Crăciun sunt în plină desfășurare. Detalii despre program și bilete.",
    date: "2025-11-28",
    category: "evenimente",
    eventDate: "2025-12-21T11:00:00",
    eventLocation: "Patinoarul Cotroceni On Ice, AFI Palace Cotroceni",
    eventAdmissionInfo: "Intrare gratuită pentru familiile cursanților",
    bodyHtml: `<h2>Magia sărbătorilor pe gheață</h2>
<p>Spectacolul de Crăciun 2025 va avea loc pe 21 decembrie la Patinoarul Cotroceni On Ice. Toți cursanții școlii vor participa într-un program artistic special.</p>
<p>Cursanții din toate grupele — de la Primii Pași până la Avansați — vor urca pe gheață pentru a demonstra tot ce au învățat în acest sezon, într-o atmosferă plină de magie și spiritul sărbătorilor de iarnă.</p>
<p>Intrarea este gratuită pentru toți membrii familiei cursanților. Locurile în tribune sunt limitate, vă rugăm să confirmați prezența prin mesaj pe canalul de WhatsApp.</p>
<p>Pregătirile au început încă din luna noiembrie, cu repetiții săptămânale dedicate coreografiilor de grup.</p>`,
  },
  {
    slug: "rezultate-cupa-edusport-toamna",
    title: "Rezultatele Cupei EduSport — Ediția de Toamnă",
    description:
      "Peste 40 de cursanți au participat la competiția internă. Descoperă clasamentele și momentele speciale.",
    date: "2025-11-20",
    category: "competitii",
    bodyHtml: `<h2>O competiție de succes</h2>
<p>Cupa EduSport — Ediția de Toamnă 2025 a adunat peste 40 de participanți din toate grupele de nivel. Competiția s-a desfășurat într-o atmosferă plină de energie și fair-play.</p>
<p>Felicitări tuturor participanților pentru efortul depus și spiritul sportiv demonstrat!</p>`,
  },
  {
    slug: "program-modificat-vacanta",
    title: "Program modificat în perioada vacanței de iarnă",
    description:
      "Vă informăm că în perioada 23 decembrie — 7 ianuarie programul cursurilor va fi modificat.",
    date: "2025-12-10",
    category: "anunturi",
    bodyHtml: `<h2>Modificări de program</h2>
<p>În perioada vacanței de iarnă (23 decembrie 2025 — 7 ianuarie 2026), programul cursurilor va suferi următoarele modificări:</p>
<ul>
<li>Cursurile de luni și miercuri se suspendă</li>
<li>Cursurile de weekend se mențin conform programului obișnuit</li>
<li>Sesiunile de antrenament individual continuă conform programărilor</li>
</ul>`,
  },
  {
    slug: "beneficii-patinaj-copii",
    title: "5 beneficii ale patinajului artistic pentru copii",
    description:
      "De la îmbunătățirea echilibrului la dezvoltarea disciplinei — descoperă cum patinajul ajută în dezvoltarea copilului tău.",
    date: "2025-09-05",
    category: "tips",
    bodyHtml: `<h2>De ce patinaj artistic?</h2>
<p>Patinajul artistic nu este doar un sport spectaculos, ci și un instrument extraordinar pentru dezvoltarea fizică și emoțională a copiilor.</p>
<h3>1. Echilibru și coordonare</h3>
<p>Patinajul dezvoltă simțul echilibrului și coordonarea motorie într-un mod unic, pe care puține sporturi îl oferă.</p>
<h3>2. Disciplină și perseverență</h3>
<p>Învățarea elementelor tehnice necesită răbdare și muncă constantă, calități care se transferă și în viața de zi cu zi.</p>
<h3>3. Încredere în sine</h3>
<p>Fiecare element nou stăpânit aduce un sentiment puternic de realizare personală.</p>
<h3>4. Socializare</h3>
<p>Cursurile de grup oferă oportunitatea de a lega prietenii și de a învăța să lucreze în echipă.</p>
<h3>5. Sănătate fizică</h3>
<p>Patinajul este un exercițiu cardiovascular complet care dezvoltă musculatura armonios.</p>`,
  },
  {
    slug: "parteneriat-federatia-patinaj",
    title: "Parteneriat cu Federația Română de Patinaj",
    description:
      "EduSport devine partener oficial al Federației Române de Patinaj pentru programele de inițiere.",
    date: "2025-08-15",
    category: "general",
    bodyHtml: `<h2>Un pas important pentru EduSport</h2>
<p>Suntem mândri să anunțăm că Școala de Patinaj EduSport a semnat un acord de parteneriat cu Federația Română de Patinaj.</p>
<p>Acest parteneriat ne permite să oferim cursanților noștri acces la competiții oficiale și la programe de dezvoltare a tinerelor talente.</p>`,
  },
  {
    slug: "cum-sa-te-pregatesti-primul-curs",
    title: "Cum să îți pregătești copilul pentru primul curs de patinaj",
    description:
      "Sfaturi practice pentru părinți: ce trebuie să știi înainte de prima lecție pe gheață.",
    date: "2025-08-01",
    category: "tips",
    bodyHtml: `<h2>Primul curs de patinaj — ghid pentru părinți</h2>
<p>Prima lecție de patinaj poate fi o experiență emoționantă atât pentru copii, cât și pentru părinți. Iată câteva sfaturi utile.</p>
<h3>Înainte de curs</h3>
<ul>
<li>Asigurați-vă că copilul a dormit bine și a mâncat cu cel puțin o oră înainte</li>
<li>Îmbrăcați-l în straturi subțiri dar calde — nu haine groase care restricționează mișcarea</li>
<li>Mănuși impermeabile sunt obligatorii</li>
</ul>
<h3>La patinoar</h3>
<p>Ajungeți cu 15 minute înainte pentru a vă familiariza cu spațiul. Instructorii noștri vă vor ghida pas cu pas.</p>`,
  },
  {
    slug: "gala-patinaj-artistic-bucuresti",
    title: "EduSport la Gala de Patinaj Artistic București 2025",
    description:
      "Cursanții noștri au participat la gala anuală, oferind momente artistice memorabile.",
    date: "2025-07-20",
    category: "evenimente",
    eventDate: "2025-07-20T18:00:00",
    eventLocation: "Patinoarul Olimpic, București",
    bodyHtml: `<h2>O seară de spectacol</h2>
<p>Gala de Patinaj Artistic București 2025 a fost un eveniment de neuitat, iar cursanții EduSport au fost printre vedetele serii.</p>
<p>Cu coreografii originale și interpretări pline de emoție, echipa noastră a demonstrat că pasiunea și talentul merg mână în mână.</p>`,
  },
  {
    slug: "noi-cursuri-incepatori-aprilie",
    title: "Noi cursuri pentru începători în aprilie",
    description:
      "Lansăm o nouă serie de cursuri pentru începători. Înscrierea este deschisă până pe 31 martie.",
    date: "2025-03-15",
    category: "anunturi",
    bodyHtml: `<h2>Cursuri noi de primăvară</h2>
<p>Începând cu luna aprilie, deschidem o nouă serie de cursuri pentru începători, adresată copiilor cu vârsta între 4 și 8 ani.</p>`,
  },
  {
    slug: "tabara-vara-2025",
    title: "Tabăra de vară de patinaj — Ediția 2025",
    description:
      "O săptămână intensivă de antrenamente, jocuri pe gheață și activități creative pentru cursanții EduSport.",
    date: "2025-06-01",
    category: "evenimente",
    eventDate: "2025-07-07T09:00:00",
    eventLocation: "Patinoarul Cotroceni On Ice",
    bodyHtml: `<h2>Tabăra de vară revine!</h2>
<p>Între 7 și 13 iulie 2025, organizăm a patra ediție a taberei de vară de patinaj. O săptămână plină de antrenamente intensive, jocuri pe gheață și activități creative.</p>`,
  },
  // Past events from cursuri/evenimente/_data.ts
  {
    slug: "cupa-edusport-primavara-2025",
    title: "Cupa EduSport – Primăvară 2025",
    description:
      "Prima competiție internă a sezonului, în care cursanții din grupele Intermediari și Avansați s-au întrecut pe elemente tehnice impuse și un scurt program liber.",
    date: "2025-05-10",
    category: "evenimente",
    eventDate: "2025-05-10T10:00:00",
    eventLocation: "Patinoarul Cotroceni On Ice",
    bodyHtml: `<h2>Cupa EduSport — Primăvară 2025</h2>
<p>Prima competiție internă a sezonului, în care cursanții din grupele Intermediari și Avansați s-au întrecut pe elemente tehnice impuse și un scurt program liber.</p>`,
  },
  {
    slug: "spectacol-de-craciun-2024",
    title: "Spectacol de Crăciun 2024",
    description:
      "Ediția 2024 a spectacolului anual de Crăciun — o seară plină de emoție și momente frumoase pe gheață, cu toți cursanții școlii.",
    date: "2024-12-22",
    category: "evenimente",
    eventDate: "2024-12-22T11:00:00",
    eventLocation: "Patinoarul Cotroceni On Ice",
    bodyHtml: `<h2>Spectacol de Crăciun 2024</h2>
<p>Ediția 2024 a spectacolului anual de Crăciun — o seară plină de emoție și momente frumoase pe gheață, cu toți cursanții școlii.</p>`,
  },
  {
    slug: "cupa-edusport-toamna-2024",
    title: "Cupa EduSport – Toamnă 2024",
    description:
      "A doua ediție a cupei interne, cu participare record — peste 40 de cursanți din toate grupele s-au înscris în competiție.",
    date: "2024-11-16",
    category: "evenimente",
    eventDate: "2024-11-16T10:00:00",
    eventLocation: "Patinoarul Cotroceni On Ice",
    bodyHtml: `<h2>Cupa EduSport – Toamnă 2024</h2>
<p>A doua ediție a cupei interne, cu participare record — peste 40 de cursanți din toate grupele s-au înscris în competiție.</p>`,
  },
  {
    slug: "tabara-de-patinaj-vara-2024",
    title: "Tabără de Patinaj – Vara 2024",
    description:
      "O săptămână intensivă de cursuri de vară pentru cursanții care au dorit să-și perfecționeze tehnica în afara sezonului obișnuit.",
    date: "2024-07-08",
    category: "evenimente",
    eventDate: "2024-07-08T09:00:00",
    eventLocation: "Patinoarul Cotroceni On Ice",
    bodyHtml: `<h2>Tabără de Patinaj – Vara 2024</h2>
<p>O săptămână intensivă de cursuri de vară pentru cursanții care au dorit să-și perfecționeze tehnica în afara sezonului obișnuit.</p>`,
  },
  {
    slug: "spectacol-de-craciun-2023",
    title: "Spectacol de Crăciun 2023",
    description:
      "Prima ediție a spectacolului de Crăciun al Școlii de Patinaj EduSport, un debut de succes pentru tradiția care continuă an de an.",
    date: "2023-12-17",
    category: "evenimente",
    eventDate: "2023-12-17T11:00:00",
    eventLocation: "Patinoarul Cotroceni On Ice",
    bodyHtml: `<h2>Spectacol de Crăciun 2023</h2>
<p>Prima ediție a spectacolului de Crăciun al Școlii de Patinaj EduSport, un debut de succes pentru tradiția care continuă an de an.</p>`,
  },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function createArticle(article) {
  const body = {
    data: {
      title: article.title,
      slug: article.slug,
      description: article.description,
      date: article.date,
      category: article.category,
      body: htmlToBlocks(article.bodyHtml),
      ...(article.eventDate && { eventDate: article.eventDate }),
      ...(article.eventLocation && { eventLocation: article.eventLocation }),
      ...(article.eventAdmissionInfo && { eventAdmissionInfo: article.eventAdmissionInfo }),
      publishedAt: new Date().toISOString(), // auto-publish
    },
  };

  const res = await fetch(`${STRAPI_URL}/api/articles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error(`  ✗ Failed: ${article.slug}`, JSON.stringify(json.error, null, 2));
    return false;
  }
  console.log(`  ✓ Created: ${article.slug}`);
  return true;
}

async function main() {
  console.log(`Seeding ${ARTICLES.length} articles into Strapi...`);

  // Check for existing articles to avoid duplicates
  const existing = await fetch(`${STRAPI_URL}/api/articles?pagination[pageSize]=100`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  }).then((r) => r.json());

  const existingSlugs = new Set((existing.data ?? []).map((a) => a.slug));
  if (existingSlugs.size > 0) {
    console.log(`Skipping ${existingSlugs.size} already-existing articles.`);
  }

  let created = 0;
  let skipped = 0;
  for (const article of ARTICLES) {
    if (existingSlugs.has(article.slug)) {
      console.log(`  — Skipped (already exists): ${article.slug}`);
      skipped++;
      continue;
    }
    const ok = await createArticle(article);
    if (ok) created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
