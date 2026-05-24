'use strict';

/**
 * Seed script - populates Strapi with all hardcoded frontend content.
 *
 * Usage (run from inside the Docker container or with Strapi running locally):
 *   docker exec strapi_app node scripts/seed-content.js
 *   -- or --
 *   node scripts/seed-content.js   (when running locally)
 *
 * Single types are always updated (PUT). Collections are only seeded when empty.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

const HISTORIC_PAGE = {
  banner: {
    title: 'Despre Noi',
    subtitle: 'Povestea clubului, valorile noastre și drumul parcurs de la înființare până azi.',
  },
  pageInfo: {
    sectionHeading: 'Peste un deceniu de patinaj și pasiune',
    sectionSubheading: 'Fondați în 2012, am crescut an de an alături de sportivii și cursanții noștri.',
    introText: [
    'Asociația Clubul Sportiv EduSport și-a propus ca misiune și totodată profesiune de credință contribuirea la dezvoltarea armonioasă a tineretului: educație prin sport, pentru o viață sănătoasă și activă, și educație pentru sport, respectiv sprijinirea sportivilor talentați, în vederea obținerii înaltei performanțe.',
    'În prezent, în cadrul clubului nostru funcționează secția de Patinaj, prin cele două componente ale sale: patinajul artistic pe gheață și patinajul artistic pe role inline.',
    'Ne dorim foarte mult să încurajăm popularizarea patinajului artistic și ca dovadă am înființat cea mai mare Școală de Patinaj din București, unde numărul de copii care învață din tainele patinajului este din ce în ce mai mare. Din 2012 până în prezent am reușit să fidelizăm foarte mulți copii, dar și să recrutăm sportivi atât pentru cursuri, cât și pentru performanță. Numărul estimat al școlii noastre este de aproximativ 150 de copii pe sezon, din care 100 participanți constanți.',
    'Cursurile Școlii de Patinaj sunt organizate pe mai multe niveluri și grupe, de la primii pași la avansați. Cei mai talentați cursanți pot fi selecționați de către antrenorii clubului pentru a participa la spectacole și demonstrații de patinaj artistic, și pentru a-și continua pregătirea în vederea practicării patinajului artistic de performanță, pe gheață sau pe role inline.',
    'În fiecare an, clubul, cu suportul familiilor sportivilor de performanță, asigură participarea sportivilor EduSport la aproximativ 10 competiții interne și internaționale, atât pe gheață, cât și pe role inline.',
    ].join('\n\n'),
  },
  stats: [
    '10+|Competiții pe an',
    '150|Copii pe sezon',
    '500+|Sportivi formați',
    '13+|Ani de activitate',
  ],
  eventsOrganized: [
    'Cupa EduSport – Patinaj Artistic pe Role Inline, ediția I, 28–29.06.2013',
    'Cupa EduSport – Patinaj Artistic pe Role Inline, ediția a II-a, 6–8.08.2014',
    'EduSport Trophy – International Figure Skating Competition (Single Skating: Seniors, Juniors, Advanced Novices, Basic Novices, Chicks & Cubs), 4–7 ianuarie 2017, Otopeni',
    'EduSport Recreational Cup, 7 ianuarie 2017',
    'Serbări tematice de Halloween, Crăciun, Paște și 1 Iunie pentru cursanții Școlii de Patinaj EduSport',
  ],
  eventsParticipated: [
    'Spectacole organizate cu ocazia zilei de 1 Decembrie, în mall-ul AFI Palace Cotroceni',
    '"Muzică, dans și speranță" - strângere de fonduri organizată de Asociația MAME, 2 iunie 2011',
    'Concert simfonic la patinoar - spectacol organizat de Primăria Sectorului 6, prin Centrul Cultural European Sector 6, 9 mai 2014',
    'Inaugurări de patinoar: City Park Constanța, patinoarul artificial din parcul Lumea Copiilor, AFI Palace Ploiești',
    'Spectacol organizat de TELUS International cu ocazia Zilei Canadei',
    'Musicalul «Alice în Țara Zăpezilor», 16–17 decembrie 2016, Cluj-Napoca',
    'Demonstrații de patinaj artistic pe role inline - Decathlon Pallady, august 2017',
  ],
};

const HISTORY_MILESTONES = [
  {
    year: '2012', order: 1,
    title: 'Înființarea Clubului',
    description: 'Asociația Clubul Sportiv EduSport a fost înființată în luna aprilie 2012, ca persoană juridică română de drept privat, fără scop patrimonial, polisportivă, apolitică și non-profit.',
  },
  {
    year: '2013', order: 2,
    title: 'Cupa EduSport - ediția I',
    description: 'Prima ediție a Cupei EduSport – Patinaj Artistic pe Role Inline, 28–29 iunie 2013, marcând debutul clubului ca organizator de competiții.',
  },
  {
    year: '2014', order: 3,
    title: 'Cupa EduSport - ediția a II-a',
    description: 'A doua ediție a Cupei EduSport – Patinaj Artistic pe Role Inline, 6–8 august 2014. Sportivii EduSport participă tot mai activ la competiții naționale, obținând primele medalii.',
  },
  {
    year: '2017', order: 4,
    title: 'EduSport Trophy - prima competiție internațională',
    description: 'EduSport Trophy – International Figure Skating Competition in Single Skating (Seniors, Juniors, Advanced Novices, Basic Novices, Chicks & Cubs), 4–7 ianuarie 2017, Otopeni. În aceeași perioadă a fost organizată și EduSport Recreational Cup.',
  },
  {
    year: '2019', order: 5,
    title: 'Rezultate la nivel internațional',
    description: 'Sportivii EduSport reprezintă România la competiții internaționale de patinaj artistic, aducând primele medalii la nivel internațional.',
  },
  {
    year: '2024', order: 6,
    title: 'Cea mai mare Școală de Patinaj din București',
    description: 'Cu aproximativ 150 de copii pe sezon (din care 100 participanți constanți), EduSport operează cea mai mare Școală de Patinaj din București, cu cursuri organizate pe mai multe niveluri, de la primii pași la avansați.',
  },
];

const CURSURI_PAGE = {
  banner: {
    title: 'Școala de Patinaj',
    scheduleDays: 'Sâmbătă & Duminică',
    scheduleTimes: '10:00–10:50 & 11:00–11:50',
    locationName: 'AFI Palace Cotroceni',
    locationUrl: 'https://maps.app.goo.gl/gmrERwQePvxYY6zx6',
  },
  aboutSection: {
    eyebrow: 'Scoala de Patinaj',
    heading: 'Patinaj pentru toți, ghidați de campioni',
    content:
      'Organizată anual în perioada octombrie – mai de foști sportivi de performanță, Școala de Patinaj EduSport oferă cursuri structurate pe mai multe niveluri - de la primii pași până la avansați.\n\nCei mai talentați cursanți pot fi selectați pentru spectacole și demonstrații de patinaj artistic sau pentru a continua pregătirea în cadrul Clubului Sportiv EduSport.',
    locationBullet: 'Patinoarul Cotroceni On Ice, AFI Palace Cotroceni',
    levelsBullet: 'Grupe pentru toate nivelurile: primii pași, începători, intermediari, avansați',
    coachesBullet: 'Antrenori - foști sportivi de performanță și atleți pasionați de patinaj',
    videoUrl: 'https://www.youtube.com/watch?v=G-0eleYxj2w',
    videoLabel: 'Cum arată cursurile noastre',
  },
  promoCard: {
    eyebrow: 'De ce să devii',
    title: 'Membru Club Sportiv EduSport',
    description:
      'Ca membru al Clubului Sportiv EduSport beneficiezi de tarife preferențiale la toate cursurile de patinaj pe durata întregului sezon.',
    subscriptionInfoTitle: 'Informații abonamente',
    subscriptionBullets: [
      '50 de minute / ședință',
      'Abonamentele sunt valabile 4 săptămâni de la prima ședință. Dacă perioada se suprapune cu un weekend fără cursuri, valabilitatea se prelungește cu o săptămână.',
      'Ședințele neefectuate nu se pot reporta sau recupera.',
    ],
  },
  infoSection: {
    sectionLabel: 'Ce trebuie să știi',
    tips: [
      'Înscrierea la cursuri se face completând formularul pe site, în limita locurilor disponibile pentru fiecare modul/grupă.',
      'În timpul cursurilor, copilul trebuie să fie echipat în ținută sport/echipament de patinaj artistic și să aibă obligatoriu mănuși.',
      'Intrarea pe patinoar se face doar pe baza abonamentului.',
      'Abonamentul este valabil 4 săptămâni de la efectuarea primei ședințe. Dacă perioada se suprapune cu un weekend fără cursuri, valabilitatea se prelungește cu încă o săptămână.',
      'În cazul în care copilul nu se prezintă la cursuri, ședințele achitate și neefectuate NU se pot recupera.',
    ],
    closingLine: 'Ne vedem pe gheață! - Echipa Școlii de Patinaj EduSport',
  },
};

const TEAM_PAGE = {
  banner: {
    title: 'Echipa Noastră',
    subtitle: 'Antrenorii și instructorii care ghidează cursanții Școlii de Patinaj EduSport.',
  },
  pageInfo: {
    introText: 'Echipa EduSport este formată din antrenori și instructori cu formare solidă în patinaj artistic, dedicați progresului fiecărui cursant - de la primii pași pe gheață până la nivelurile avansate. Fiecare membru al echipei îmbină experiența tehnică cu răbdarea și entuziasmul pentru a crea un mediu de învățare sigur și motivant.',
  },
};

const TEAM_MEMBERS = [
  {
    order: 1,
    name: 'Cristina Moldovan',
    role: 'Antrenor Principal',
    bio: 'Fostă patinatoare de performanță cu peste 15 ani de experiență în patinajul artistic de competiție. Coordonează programul tehnic al școlii și pregătește sportivii pentru competiții naționale și internaționale.',
    groups: ['Avansați', 'Grup Performanță'],
  },
  {
    order: 2,
    name: 'Mihai Dumitrescu',
    role: 'Antrenor',
    bio: 'Antrenor cu 8 ani de experiență în predarea tehnicilor de patinaj artistic. Specializat în lucrul cu grupele de intermediari și în dezvoltarea elementelor tehnice de bază.',
    groups: ['Intermediari', 'Avansați'],
  },
  {
    order: 3,
    name: 'Andreea Stanciu',
    role: 'Antrenor',
    bio: 'Absolventă a Facultății de Educație Fizică și Sport, cu specializare în patinaj artistic. Pasionată de pedagogie sportivă, pune accent pe corectitudinea tehnică și pe bucuria mișcării pe gheață.',
    groups: ['Începători', 'Intermediari'],
  },
  {
    order: 4,
    name: 'Bogdan Radu',
    role: 'Asistent',
    bio: 'Asistent antrenor cu background în patinaj de viteză, ajutat cursanții de la grupa primii pași să capete încredere pe gheață. Empatic și răbdător, crează un mediu relaxant pentru copiii la prima experiență.',
    groups: ['Primii Pași', 'Începători'],
  },
  {
    order: 5,
    name: 'Ioana Constantin',
    role: 'Coordonator Copii & Părinți',
    bio: 'Gestionează comunicarea cu familiile cursanților, coordonează logistica grupelor și asigură o experiență plăcută și organizată pentru copii și părinți. Primul punct de contact pentru orice întrebare legată de cursuri.',
    groups: [],
  },
  {
    order: 6,
    name: 'Ana Maria Stoica',
    role: 'Coregraf',
    bio: 'Coregrafă cu experiență în patinaj artistic, lucrează cu sportivii clubului pe interpretarea muzicală și expresia artistică a programelor.',
    groups: ['Avansați'],
  },
  {
    order: 7,
    name: 'Răzvan Marin',
    role: 'Coregraf',
    bio: 'Coregraf specializat în coregrafii contemporane pentru competiții internaționale.',
    groups: ['Avansați'],
  },
];

// Disciplines — editable by admin, but seeded with the standard set covering
// the club's figure-skating + inline activities.
const DISCIPLINES = [
  'Patinaj Artistic',
  'Patinaj Perechi',
  'Ice Dance',
  'Inline Skates',
];

// Maps the old enum value on existing seed entries to the new discipline
// names. "Gheață" → on-ice (Patinaj Artistic), "Role inline" → inline,
// "Ambele" → both. Used during seeding to translate legacy values.
const DISCIPLINE_FROM_LEGACY = {
  'Gheață': ['Patinaj Artistic'],
  'Role inline': ['Inline Skates'],
  'Ambele': ['Patinaj Artistic', 'Inline Skates'],
};

const REALIZARI_PAGE = {
  banner: {
    bannerTitle: 'REALIZĂRI',
    bannerSubtitle: 'Rezultatele sportivilor EduSport la competiții naționale și internaționale de patinaj artistic.',
  },
  notableAchievements: [
    'Locul 1 la Campionatul Național de Patinaj Artistic - categoria Juniori I, ediția 2024',
    'Locul 2 la Cupa României - categoria Juniori II, București 2024',
    'Participare la Trofeul Internațional "Ice Star" Minsk, Belarus - Top 5 în categorie',
    'Locul 1 la Campionatul Național - categoria Novice, ediția 2023',
    'Locul 3 la Cupa României - categoria Seniori, Cluj-Napoca 2023',
    'Echipa EduSport clasată pe locul 1 în clasamentul pe cluburi la Campionatul Național 2023',
    'Participare la competiția internațională "Prague Skate" - primul podium internațional al clubului',
    'Locul 2 la Campionatul Național - categoria Pre-Novice, ediția 2022',
  ],
};

// Sportspeople — club athletes. Entries with `showPublicPage: true` get a
// public profile at /despre-noi/sportivi/<slug>. The `name` here must match
// the `athleteName` strings in COMPETITIONS for the participant relation to
// be linked during seeding; unmatched athleteName strings stay as plain
// strings (external athletes).
const SPORTSPEOPLE = [
  {
    name: 'Maria Popescu',
    slug: 'maria-popescu',
    showPublicPage: true,
    activeSince: '2018-01-01',
    description: 'Sportivă de top a clubului EduSport, multiplă campioană națională la categoria Avansați – Juniors.',
    favoriteMoves: ['Triple Lutz', 'Sărituri combinate', 'Spirală Biellmann', 'Piruetă combinată'],
    hobbies: ['Lectură', 'Pian', 'Drumeții montane'],
    disciplineNames: ['Patinaj Artistic'],
    coachName: 'Andreea Stanciu',
    choreographerNames: ['Ana Maria Stoica'],
    careerGoal: 'Vreau să reprezint România la Campionatul European de Patinaj Artistic.',
    seasons: [
      {
        season: '2024-2025',
        programs: [
          { type: 'Program Scurt', title: 'Carmen Suite', artist: 'Georges Bizet' },
          { type: 'Program Liber', title: 'Moonlight Sonata', artist: 'Ludwig van Beethoven' },
        ],
      },
      {
        season: '2023-2024',
        programs: [
          { type: 'Program Liber', title: 'Swan Lake', artist: 'Pyotr Ilyich Tchaikovsky' },
        ],
      },
    ],
  },
  {
    name: 'Elena Dumitrescu',
    slug: 'elena-dumitrescu',
    showPublicPage: true,
    activeSince: '2017-01-01',
    description: 'Patinatoare la categoria Avansați – Seniors, cu rezultate notabile la competiții internaționale.',
    favoriteMoves: ['Double Axel', 'Spirală Ina Bauer', 'Piruetă layback'],
    hobbies: ['Pictură', 'Yoga', 'Călătorii'],
    disciplineNames: ['Patinaj Artistic'],
    coachName: 'Andreea Stanciu',
    choreographerNames: ['Răzvan Marin'],
    seasons: [
      {
        season: '2024-2025',
        programs: [
          { type: 'Program Scurt', title: 'La Vie en Rose', artist: 'Édith Piaf' },
          { type: 'Program Liber', title: 'Bohemian Rhapsody', artist: 'Queen' },
        ],
      },
    ],
  },
  {
    name: 'Ana Vasile',
    slug: 'ana-vasile',
    showPublicPage: true,
    activeSince: '2020-01-01',
    description: 'Tânără speranță a clubului, evoluează la categoriile Începători și Intermediari.',
    favoriteMoves: ['Sărituri simple', 'Spin scaun', 'Spirala arabesque'],
    hobbies: ['Înot', 'Desen', 'Voluntariat'],
    disciplineNames: ['Patinaj Artistic'],
    coachName: 'Bogdan Radu',
    careerGoal: 'Să ating categoria Avansați – Juniors până la finalul sezonului 2026.',
    seasons: [
      {
        season: '2024-2025',
        programs: [
          { type: 'Program Liber', title: 'Clair de Lune', artist: 'Claude Debussy' },
        ],
      },
    ],
  },
  {
    name: 'Andrei Ionescu',
    slug: 'andrei-ionescu',
    showPublicPage: false,
    activeSince: '2019-01-01',
    description: 'Sportiv în categoria Intermediari.',
  },
  {
    name: 'Sofia Marin',
    slug: 'sofia-marin',
    showPublicPage: true,
    activeSince: '2021-01-01',
    description: 'Sportivă debutantă, urcă rapid din categoria Începători. Pasionată de patinaj de mică, antrenamentele intense au început să dea roade în ultimele sezoane.',
    favoriteMoves: ['Salchow simplu', 'Spirală arabesque', 'Piruetă verticală'],
    hobbies: ['Balet', 'Muzică', 'Schi'],
    disciplineNames: ['Patinaj Artistic', 'Inline Skates'],
    coachName: 'Bogdan Radu',
    careerGoal: 'Vreau să cuceresc primul podium național.',
    seasons: [
      {
        season: '2024-2025',
        programs: [
          { type: 'Program Liber', title: 'Por Una Cabeza', artist: 'Carlos Gardel' },
        ],
      },
    ],
  },
  // ── Additional 25 athletes — fictional, used to fill the grid for visual
  //    QA. Most are public; a few are kept private. None are linked to the
  //    8 competition entries (those still mention only the original 5 by
  //    athleteName), so these show up with "no medals" on the index.
  { name: 'Ștefana Anghel',     slug: 'stefana-anghel',     showPublicPage: true,  activeSince: '2019-01-01', disciplineNames: ['Patinaj Artistic'],                    description: 'Patinatoare entuziastă a clubului EduSport.',                                  favoriteMoves: ['Loop', 'Spin scaun'],                          hobbies: ['Citit', 'Cățărări'] },
  { name: 'Iulian Marinescu',   slug: 'iulian-marinescu',   showPublicPage: true,  activeSince: '2018-01-01', disciplineNames: ['Patinaj Artistic'],                    description: 'Sportiv tenace din categoria Avansați.',                                       favoriteMoves: ['Double Lutz', 'Spin combinat'],                 hobbies: ['Schi', 'Fotografie'] },
  { name: 'Carmen Cojocaru',    slug: 'carmen-cojocaru',    showPublicPage: true,  activeSince: '2020-01-01', disciplineNames: ['Inline Skates'],                       description: 'Specializată pe patinaj artistic pe role inline.',                              hobbies: ['Dans', 'Volei'] },
  { name: 'David Stancu',       slug: 'david-stancu',       showPublicPage: true,  activeSince: '2022-01-01', disciplineNames: ['Patinaj Artistic'],                    description: 'Tânără speranță, evoluează la categoria Începători.',                          favoriteMoves: ['Waltz jump', 'Sărituri simple'] },
  { name: 'Ioana Florea',       slug: 'ioana-florea',       showPublicPage: true,  activeSince: '2017-01-01', disciplineNames: ['Patinaj Artistic'],                    description: 'Patinatoare experimentată, multipli ani de competiții.',                       favoriteMoves: ['Triple Salchow', 'Spirală layback'], hobbies: ['Pian', 'Pictură'] },
  { name: 'Tudor Voicu',        slug: 'tudor-voicu',        showPublicPage: false, activeSince: '2021-01-01',                                                            description: 'Sportiv la categoria Intermediari.' },
  { name: 'Bianca Bădescu',     slug: 'bianca-badescu',     showPublicPage: true,  activeSince: '2019-01-01', disciplineNames: ['Patinaj Artistic'],                                                                                                                                hobbies: ['Echitație', 'Muzică'] },
  { name: 'Marian Diaconu',     slug: 'marian-diaconu',     showPublicPage: true,  activeSince: '2016-01-01', disciplineNames: ['Patinaj Artistic', 'Inline Skates'],   description: 'Sportiv versatil, concurează pe gheață și pe role inline.',                    favoriteMoves: ['Axel', 'Sărituri combinate', 'Piruetă combinată'] },
  { name: 'Andreea Mihalache',  slug: 'andreea-mihalache',  showPublicPage: true,  activeSince: '2020-01-01', disciplineNames: ['Patinaj Artistic'],                    description: 'Concurează în categoria Intermediari.' },
  { name: 'Vlad Petrescu',      slug: 'vlad-petrescu',      showPublicPage: true,  activeSince: '2023-01-01', disciplineNames: ['Patinaj Artistic'],                    description: 'Debutant promițător, începutul carierei competiționale.' },
  { name: 'Cătălina Călinescu', slug: 'catalina-calinescu', showPublicPage: true,  activeSince: '2018-01-01', disciplineNames: ['Patinaj Artistic'],                                                                                                                                favoriteMoves: ['Spirală Ina Bauer', 'Piruetă layback'], hobbies: ['Yoga'] },
  { name: 'Răzvan Sava',        slug: 'razvan-sava',        showPublicPage: false, activeSince: '2022-01-01' },
  { name: 'Daria Manole',       slug: 'daria-manole',       showPublicPage: true,  activeSince: '2019-01-01', disciplineNames: ['Patinaj Artistic'],                    description: 'Patinatoare cu rezultate notabile la competiții regionale.' },
  { name: 'Cosmin Negru',       slug: 'cosmin-negru',       showPublicPage: true,  activeSince: '2020-01-01', disciplineNames: ['Inline Skates'] },
  { name: 'Patricia Tudose',    slug: 'patricia-tudose',    showPublicPage: true,  activeSince: '2017-01-01', disciplineNames: ['Patinaj Artistic'],                    description: 'Sportivă experimentată cu rezultate la categoria Avansați.',                   hobbies: ['Lectură', 'Atletism'] },
  { name: 'Liviu Vasile',       slug: 'liviu-vasile',       showPublicPage: true,  activeSince: '2021-01-01', disciplineNames: ['Patinaj Artistic'] },
  { name: 'Roxana Toma',        slug: 'roxana-toma',        showPublicPage: true,  activeSince: '2018-01-01', disciplineNames: ['Patinaj Artistic'],                    description: 'Patinatoare cu pasiune pentru programe expresive.',                            favoriteMoves: ['Spin scaun', 'Spirală arabesque', 'Piruetă verticală'] },
  { name: 'Adrian Munteanu',    slug: 'adrian-munteanu',    showPublicPage: false, activeSince: '2023-01-01' },
  { name: 'Camelia Banu',       slug: 'camelia-banu',       showPublicPage: true,  activeSince: '2019-01-01', disciplineNames: ['Patinaj Artistic'],                                                                                                                                hobbies: ['Cinema', 'Dans'] },
  { name: 'Sebastian Stoica',   slug: 'sebastian-stoica',   showPublicPage: true,  activeSince: '2022-01-01', disciplineNames: ['Patinaj Artistic'],                    description: 'Sportiv în categoria Începători, antrenamente intense în derulare.' },
  { name: 'Adelina Dragomir',   slug: 'adelina-dragomir',   showPublicPage: true,  activeSince: '2018-01-01', disciplineNames: ['Patinaj Artistic'],                    description: 'Patinatoare la categoria Avansați – Juniors.',                                  favoriteMoves: ['Double Axel', 'Triple Toe Loop'] },
  { name: 'Octavian Iliescu',   slug: 'octavian-iliescu',   showPublicPage: true,  activeSince: '2020-01-01', disciplineNames: ['Patinaj Artistic'] },
  { name: 'Alexandra Stănescu', slug: 'alexandra-stanescu', showPublicPage: true,  activeSince: '2017-01-01', disciplineNames: ['Patinaj Artistic'],                    description: 'Una dintre cele mai vechi sportive ale clubului.',                             hobbies: ['Înot', 'Călărie', 'Călătorii'] },
  { name: 'George Predescu',    slug: 'george-predescu',    showPublicPage: false, activeSince: '2021-01-01' },
  { name: 'Beatrice Rotaru',    slug: 'beatrice-rotaru',    showPublicPage: true,  activeSince: '2019-01-01', disciplineNames: ['Patinaj Artistic', 'Inline Skates'],   description: 'Patinatoare versatilă pe gheață și role inline.' },
];

const COMPETITIONS = [
  // ── Sezon 2024-2025 ──
  {
    name: 'Campionatul Național de Patinaj Artistic',
    date: '2025-03-15',
    location: 'București',
    level: 'national',
    season: '2024-2025',
    participants: [
      { athleteName: 'Maria Popescu',    category: 'Avansați – Juniors',  placement: '1',   score: 92.15 },
      { athleteName: 'Andrei Ionescu',   category: 'Intermediari',        placement: '2', score: 78.30 },
      { athleteName: 'Elena Dumitrescu', category: 'Avansați – Seniors',  placement: '3', score: 88.47 },
      { athleteName: 'Luca Stan',        category: 'Intermediari',        placement: '4',    score: 74.12 },
      { athleteName: 'Ana Vasile',       category: 'Avansați – Juniors',  placement: '6',    score: 81.60 },
    ],
  },
  {
    name: 'Cupa României',
    date: '2025-01-18',
    location: 'Cluj-Napoca',
    level: 'national',
    season: '2024-2025',
    participants: [
      { athleteName: 'Sofia Marin',    category: 'Începători',       placement: '1',   score: 65.80 },
      { athleteName: 'Maria Popescu',  category: 'Avansați – Juniors', placement: '1', score: 89.92 },
      { athleteName: 'Luca Stan',      category: 'Intermediari',     placement: '2', score: 72.55 },
      { athleteName: 'Andrei Ionescu', category: 'Intermediari',     placement: '5',    score: 68.40 },
    ],
  },
  {
    name: 'International Ice Cup',
    date: '2024-11-09',
    location: 'Budapesta, Ungaria',
    level: 'international',
    season: '2024-2025',
    participants: [
      { athleteName: 'Maria Popescu',    category: 'Avansați – Juniors', placement: '2', score: 86.73 },
      { athleteName: 'Elena Dumitrescu', category: 'Avansați – Seniors', placement: '3', score: 84.20 },
      { athleteName: 'Sofia Marin',      category: 'Începători',         placement: '10',  score: 58.15 },
    ],
  },
  // ── Sezon 2023-2024 ──
  {
    name: 'Campionatul Național de Patinaj Artistic',
    date: '2024-03-16',
    location: 'București',
    level: 'national',
    season: '2023-2024',
    participants: [
      { athleteName: 'Maria Popescu',  category: 'Avansați – Juniors', placement: '1',   score: 87.60 },
      { athleteName: 'Ana Vasile',     category: 'Intermediari',       placement: '1',   score: 76.45 },
      { athleteName: 'Luca Stan',      category: 'Începători',         placement: '3', score: 62.30 },
      { athleteName: 'Andrei Ionescu', category: 'Începători',         placement: '4',    score: 59.85 },
    ],
  },
  {
    name: 'Cupa României',
    date: '2023-12-09',
    location: 'Brașov',
    level: 'national',
    season: '2023-2024',
    participants: [
      { athleteName: 'Elena Dumitrescu', category: 'Avansați – Seniors', placement: '2', score: 82.10 },
      { athleteName: 'Sofia Marin',      category: 'Începători',         placement: '1',   score: 61.25 },
      { athleteName: 'Luca Stan',        category: 'Începători',         placement: '5',    score: 55.70 },
    ],
  },
  {
    name: 'Skate Vienna Trophy',
    date: '2023-10-14',
    location: 'Viena, Austria',
    level: 'international',
    season: '2023-2024',
    participants: [
      { athleteName: 'Maria Popescu',    category: 'Avansați – Juniors', placement: '1', score: 85.30 },
      { athleteName: 'Elena Dumitrescu', category: 'Avansați – Seniors', placement: '6',  score: 79.15 },
    ],
  },
  // ── Sezon 2022-2023 ──
  {
    name: 'Campionatul Național de Patinaj Artistic',
    date: '2023-03-18',
    location: 'București',
    level: 'national',
    season: '2022-2023',
    participants: [
      { athleteName: 'Ana Vasile',     category: 'Începători',   placement: '1',   score: 64.90 },
      { athleteName: 'Maria Popescu',  category: 'Intermediari', placement: '2', score: 73.25 },
      { athleteName: 'Andrei Ionescu', category: 'Începători',   placement: '10',  score: 52.80 },
    ],
  },
  {
    name: 'Cupa Carpaților',
    date: '2023-01-21',
    location: 'Brașov',
    level: 'national',
    season: '2022-2023',
    participants: [
      { athleteName: 'Elena Dumitrescu', category: 'Avansați – Seniors', placement: '1',   score: 80.55 },
      { athleteName: 'Sofia Marin',      category: 'Începători',         placement: '2', score: 57.40 },
      { athleteName: 'Andrei Ionescu',   category: 'Începători',         placement: '3', score: 54.15 },
      { athleteName: 'Luca Stan',        category: 'Începători',         placement: '4',    score: 51.90 },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Seed functions
// ─────────────────────────────────────────────────────────────────────────────

async function seedHistoricPage() {
  console.log('\n📖  Seeding historic-page…');
  const existing = await strapi.documents('api::historic-page.historic-page').findFirst();
  if (existing) {
    await strapi.documents('api::historic-page.historic-page').update({
      documentId: existing.documentId,
      data: HISTORIC_PAGE,
    });
    console.log('   ✅  Updated existing entry');
  } else {
    await strapi.documents('api::historic-page.historic-page').create({ data: HISTORIC_PAGE });
    console.log('   ✅  Created entry');
  }
}

async function seedHistoryMilestones() {
  console.log('\n🏆  Seeding history-milestones…');
  const existing = await strapi.documents('api::history-milestone.history-milestone').findMany();
  if (existing.length > 0) {
    console.log(`   ⏭   Already has ${existing.length} entries - skipping`);
    return;
  }
  for (const m of HISTORY_MILESTONES) {
    await strapi.documents('api::history-milestone.history-milestone').create({ data: m });
    console.log(`   ✅  ${m.year}: ${m.title}`);
  }
}

async function seedCursuriPage() {
  console.log('\n🛹  Seeding cursuri-page…');
  const existing = await strapi.documents('api::cursuri-page.cursuri-page').findFirst();
  if (existing) {
    await strapi.documents('api::cursuri-page.cursuri-page').update({
      documentId: existing.documentId,
      data: CURSURI_PAGE,
    });
    console.log('   ✅  Updated existing entry');
  } else {
    await strapi.documents('api::cursuri-page.cursuri-page').create({ data: CURSURI_PAGE });
    console.log('   ✅  Created entry');
  }
}

async function seedRealizariPage() {
  console.log('\n🥇  Seeding realizari-page…');
  const existing = await strapi.documents('api::realizari-page.realizari-page').findFirst();
  if (existing) {
    await strapi.documents('api::realizari-page.realizari-page').update({
      documentId: existing.documentId,
      data: REALIZARI_PAGE,
    });
    console.log('   ✅  Updated existing entry');
  } else {
    await strapi.documents('api::realizari-page.realizari-page').create({ data: REALIZARI_PAGE });
    console.log('   ✅  Created entry');
  }
}

async function seedTeamPage() {
  console.log('\n👥  Seeding team-page…');
  const existing = await strapi.documents('api::team-page.team-page').findFirst();
  if (existing) {
    await strapi.documents('api::team-page.team-page').update({
      documentId: existing.documentId,
      data: TEAM_PAGE,
    });
    console.log('   ✅  Updated existing entry');
  } else {
    await strapi.documents('api::team-page.team-page').create({ data: TEAM_PAGE });
    console.log('   ✅  Created entry');
  }
}

async function seedTeamMembers() {
  console.log('\n🧑‍🏫  Seeding team-members…');
  const existing = await strapi.documents('api::team-member.team-member').findMany();
  if (existing.length > 0) {
    console.log(`   ⏭   Already has ${existing.length} entries - skipping`);
    return;
  }
  for (const m of TEAM_MEMBERS) {
    await strapi.documents('api::team-member.team-member').create({ data: m });
    console.log(`   ✅  ${m.name} (${m.role})`);
  }
}

async function seedDisciplines() {
  console.log('\n🎯  Seeding disciplines…');
  const existing = await strapi.documents('api::discipline.discipline').findMany();
  if (existing.length > 0) {
    console.log(`   ⏭   Already has ${existing.length} entries - skipping`);
    return new Map(existing.map((d) => [d.name, d.documentId]));
  }
  const byName = new Map();
  for (const name of DISCIPLINES) {
    const created = await strapi.documents('api::discipline.discipline').create({
      data: { name },
    });
    byName.set(name, created.documentId);
    console.log(`   ✅  ${name}`);
  }
  return byName;
}

async function seedSportspeople(disciplineByName) {
  console.log('\n⛸️   Seeding sportspeople…');
  const existing = await strapi.documents('api::sportsperson.sportsperson').findMany();
  if (existing.length > 0) {
    console.log(`   ⏭   Already has ${existing.length} entries - skipping`);
    return new Map(existing.map((s) => [s.name, s.documentId]));
  }

  // Resolve coach / choreographer references (SPORTSPEOPLE entries carry
  // coachName + choreographerNames strings; turn them into Strapi relation
  // `connect` payloads by looking up matching team-members by name).
  const teamMembers = await strapi.documents('api::team-member.team-member').findMany();
  const teamMemberByName = new Map(teamMembers.map((tm) => [tm.name, tm.documentId]));

  const nameToDocId = new Map();
  for (const sp of SPORTSPEOPLE) {
    const { coachName, choreographerNames, disciplineNames, ...rest } = sp;
    const data = { ...rest };

    if (coachName) {
      const coachDocId = teamMemberByName.get(coachName);
      if (coachDocId) {
        data.coach = { connect: [{ documentId: coachDocId }] };
      } else {
        console.warn(`   ⚠   Coach "${coachName}" not found for ${sp.name}`);
      }
    }

    if (Array.isArray(choreographerNames) && choreographerNames.length > 0) {
      const connect = [];
      for (const cn of choreographerNames) {
        const docId = teamMemberByName.get(cn);
        if (docId) connect.push({ documentId: docId });
        else console.warn(`   ⚠   Choreographer "${cn}" not found for ${sp.name}`);
      }
      if (connect.length > 0) data.choreographers = { connect };
    }

    if (Array.isArray(disciplineNames) && disciplineNames.length > 0) {
      const connect = [];
      for (const dn of disciplineNames) {
        const docId = disciplineByName.get(dn);
        if (docId) connect.push({ documentId: docId });
        else console.warn(`   ⚠   Discipline "${dn}" not found for ${sp.name}`);
      }
      if (connect.length > 0) data.disciplines = { connect };
    }

    const created = await strapi.documents('api::sportsperson.sportsperson').create({
      data,
      status: 'published',
    });
    nameToDocId.set(sp.name, created.documentId);
    console.log(`   ✅  ${sp.name}${sp.showPublicPage ? ' (public)' : ''}`);
  }
  return nameToDocId;
}

async function seedCompetitions(nameToSportspersonDocId) {
  console.log('\n🏅  Seeding competitions…');
  const existing = await strapi.documents('api::competition.competition').findMany();
  if (existing.length > 0) {
    console.log(`   ⏭   Already has ${existing.length} entries - skipping`);
    return;
  }
  const map = nameToSportspersonDocId ?? new Map();
  for (const comp of COMPETITIONS) {
    // Enrich each participant with a sportsperson connection when the
    // athleteName matches a seeded sportsperson. Unmatched names stay as
    // plain string-only (external club athletes).
    const enrichedParticipants = comp.participants.map((p) => {
      const docId = map.get(p.athleteName);
      return docId
        ? { ...p, sportsperson: { connect: [{ documentId: docId }] } }
        : p;
    });
    await strapi.documents('api::competition.competition').create({
      data: { ...comp, participants: enrichedParticipants },
    });
    console.log(`   ✅  ${comp.season} - ${comp.name} (${comp.participants.length} participants)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    await seedHistoricPage();
    await seedHistoryMilestones();
    await seedCursuriPage();
    await seedRealizariPage();
    // Seed team members BEFORE sportspeople so the coach relation can be
    // resolved by name. Sportspeople then seed BEFORE competitions so the
    // participant.sportsperson relation can be linked by athleteName.
    await seedTeamPage();
    await seedTeamMembers();
    const disciplineByName = await seedDisciplines();
    const nameToSportspersonDocId = await seedSportspeople(disciplineByName);
    await seedCompetitions(nameToSportspersonDocId);
    console.log('\n✨  All seeds complete!\n');
  } catch (err) {
    console.error('\n❌  Seed failed:', err);
    process.exit(1);
  }

  await app.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
