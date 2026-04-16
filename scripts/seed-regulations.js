'use strict';

const CATEGORIES = [
  {
    title: 'Eligibilitate & Înscriere',
    icon: 'Users',
    rules: [
      { highlight: false, label: 'Accept parental & echipament protecție', text: 'Copilul minor trebuie sa aiba acceptul parintelui de a intra pe gheata si de a participa la curs, iar parintele este raspunzator pentru aceasta initiativa si pentru echipamentul de protectie pe care il va/nu-l va purta copilul pe parcursul cursului (patine, casca de protectie, genunchiere, cotiere, etc).' },
      { highlight: false, label: 'Vârsta minimă 4 ani', text: 'Participantul la curs trebuie sa aiba varsta minima de 4 ani si capacitatea de a comunica si intelege ce ii transmite instructorul. In cazuri exceptionale, in functie de evaluarea facuta de instructori, pot fi acceptati si copii sub 4 ani.' },
      { highlight: false, label: 'Fișă de înscriere la prima ședință', text: 'La prima sedinta de curs, parintele/tutorele legal va completa o fisa de inscriere, in care va declara pe proprie raspundere daca fiul/fiica sa este "Apt pentru efort fizic".' },
      { highlight: false, label: 'Informare instructor despre probleme de sănătate', text: 'Tutorele sau participantul trebuie sa informeze instructorul despre problemele de sanatate temporare si/sau daca apar probleme medicale in timpul desfasurarii cursului.' },
      { highlight: false, label: 'Înscriere doar online', text: 'Inscrierea la cursuri se poate face doar online pe site-ul www.scoaladepatinaj.com' },
      { highlight: true,  label: 'Locuri limitate, în ordinea înscrierii', text: 'Numarul locurilor este limitat pentru fiecare grupa/ora in parte. Ocuparea locurilor vacante se va face in ordinea inscrierii la cursuri.' },
      { highlight: false, label: 'Taxa de membru — o dată pe sezon', text: 'Taxa de membru se achita o singura data pe sezon, la inscrierea la cursurile noastre, indiferent de momentul inscrierii la cursuri si este valabila in perioada octombrie – mai. Taxa nu este fractionara.' },
      { highlight: false, label: 'Abonament valabil 4 săptămâni', text: 'Abonamentul este valabil 4 saptamani de la efectuarea primei sedinte! In cazul in care, perioada de 4 saptamani se suprapune cu un weekend in care nu se fac cursuri, valabilitatea abonamentului se prelungeste cu inca o saptamana.' },
    ],
  },
  {
    title: 'Prezență & Recuperări',
    icon: 'CalendarCheck',
    rules: [
      { highlight: true,  label: 'Ședințele neefectuate nu se recuperează', text: 'Sedintele achitate si neefectuate pe parcursul celor 4 saptamani nu se pot reporta/recupera.' },
      { highlight: false, label: 'Recuperare medicală — max 2 ședințe', text: 'In cazul in care se lipseste din motive medicale, se pot recupera 2 sedinte, in baza unei adeverinte medicale.' },
      { highlight: false, label: 'Rezervare modul următor în ultimele 2 ședințe', text: 'Rezervarea locurilor pentru urmatorul modul se face prin achizitionarea unui nou abonament in ultimele 2 sedinte ale modulului curent. In cazul in care abonamentele nu sunt achitate in perioada respectiva, locul este declarat din nou vacant, urmand sa inscriem urmatoarea persoana de pe lista. Regula se aplica atat pentru non-membri, cat si pentru membri.' },
      { highlight: false, label: 'Prezență cu 20 min înainte pentru încălzire', text: 'Prezenta la curs se face cu minimum 20 minute inainte de intrarea pe gheata, pentru efectuarea incalzirii. Incalzirea se efectueaza de fiecare copil, in mod independent (sub supravegherea parintilor).' },
    ],
  },
  {
    title: 'Grupe & Avansare',
    icon: 'Layers',
    rules: [
      { highlight: false, label: 'Grupa comunicată după înscriere și testare', text: 'Grupa/ora la care va fi incadrat cursantul, va fi comunicata dupa inscriere, urmand ca programarea finala a orei sa fie stabilita dupa testarea efectiva a cursantului (in prima ora de curs).' },
      { highlight: false, label: 'Selecție „Avansați" pe criterii tehnice', text: 'Selectia cursantilor pentru grupele de "Avansati" va fi realizata de catre antrenorul acestei grupe, in baza unor elemente tehnice pe care trebuie sa le execute sportivii.' },
      { highlight: false, label: 'Avansare doar după îndeplinirea elementelor tehnice', text: 'Avansarea copiilor de la o grupa la alta se va face de catre instructori doar in momentul in care cursantul va realiza corect elementele tehnice necesare pentru elementele lucrate la urmatoarea grupa.' },
      { highlight: false, label: '8–10 cursanți/ședință (începători), ~15 (avansați)', text: 'Fiecare instructor se va ocupa de un numar de 8–10 cursanti/sedinta la grupele primii pasi si incepatori si aprox 15 cursanti/sedinta la grupele intermediari si avansati.' },
      { highlight: true,  label: 'Abonament include intrare, NU include închiriere patine', text: 'Intrarea pe patinoar se face doar pe baza abonamentului. Pretul abonamentului include intrarea pe patinoar si antrenamentul. Inchirierea patinelor NU este inclusa in abonament.' },
    ],
  },
  {
    title: 'Reguli pe Gheață',
    icon: 'ShieldAlert',
    rules: [
      { highlight: false, label: 'Intrare pe poarta principală, interzis peste mantinelă', text: 'Intrarea pe patinoar se face doar pe poarta principala sau prin locul indicat de instructori. Este interzis accesul peste mantinela.' },
      { highlight: false, label: 'Echipament obligatoriu: patine, mănuși, fără bijuterii', text: 'Toti copiii vor participa la cursuri echipati astfel: patine, manusi, tinuta sport, echipament de patinaj, fara bijuterii sau accesorii vestimentare care sa atarne. De asemenea, parul trebuie sa fie prins.' },
      { highlight: false, label: 'Patine artistice obligatorii la intermediari/avansați', text: 'La grupele de intermediari si avansati sunt obligatorii patinele speciale de patinaj artistic.' },
      { highlight: false, label: 'Fără mâncare/băutură pe gheață', text: 'Servirea de mancare si bauturi pe aria ghetii nu este permisa in timpul antrenamentelor. Instructorii vor oferi pauze organizate pentru hidratare.' },
      { highlight: false, label: 'Fără obiecte străine patinoarului pe gheață', text: 'Participantii la curs nu au voie sa foloseasca, pe gheata, obiecte straine patinoarului.' },
      { highlight: false, label: 'Comunicare și atenție la indicațiile instructorului', text: 'Participantii la curs trebuie sa comunice cu instructorul si sa fie foarte atenti la indicatiile acestuia.' },
      { highlight: false, label: 'Fără interacțiune părinți–copii pe gheață', text: 'Sa se respecte organizarea cursului si sa se evite interactionarea dintre parinti si copii.' },
      { highlight: false, label: 'Jocul liber pe gheață interzis', text: 'Jocul pe gheata nu este permis cu exceptia cazurilor in care face parte din pregatirea cursului.' },
      { highlight: false, label: 'Patine închiriate — fără ieșire din aria patinoarului', text: 'Patinele inchiriate de la patinoar trebuie pastrate cu grija, nefiind acceptata pasirea cu ele pe gresia, marmura sau in alte spatii din afara ariei patinoarului.' },
      { highlight: false, label: 'Părăsire gheață doar cu acordul instructorului', text: 'Parasirea ghetii inainte de finalizarea cursului (in cazul nevoilor urgente – de folosire a toaletelor) se face prin invoirea de la instructor si numai in prezenta tutorelui.' },
    ],
  },
  {
    title: 'Securitate, Răspundere & Comunicare',
    icon: 'MessageCircle',
    rules: [
      { highlight: false, label: 'Risc de accidentare inerent sportului', text: 'Este important de mentionat ca, avand in vedere natura acestui sport, fiecare cursant poate fi expus la un risc de accidentare, care poate be minimizat prin respectarea indrumărilor oferite de instructori si prin respectarea programului impus de acestia.' },
      { highlight: true,  label: 'Instructorii nu răspund pentru accidente cauzate de abateri', text: 'Prin inscrierea la cursul de patinaj, parintii/tutorii declara ca sunt constienti de riscurile asociate cu practicarea acestui sport, inclusiv posibilitatea accidentarilor in urma exercitiilor desfasurate pe gheata. Instructorii si asistentii patinoarului nu isi asuma responsabilitatea pentru niciun incident sau accident care ar putea aparea din cauza abaterilor participantilor de la regulile stabilite.' },
      { highlight: false, label: 'Drept de fotografiere și filmare ACS EduSport', text: 'Asociatia Clubul Sportiv EduSport isi rezerva dreptul de a fotografia si inregistra audio-video cursurile, serbarile sau orice alt eveniment organizat de ACS EduSport sau partenerii acestuia, in care apar cursantii Scolii de Patinaj EduSport sau orice sportiv legitimat la ACS EduSport, respectiv de a utiliza imaginile pentru promovarea activitatii ACS EduSport.' },
      { highlight: false, label: 'Informații actualizate pe canalul WhatsApp', text: 'Informatiile actualizate cu privire la program vor fi postate pe canalul de WhatsApp: Scoala de Patinaj EduSport (https://whatsapp.com/channel/0029VaYiSuXAojmCFCLGUm1P). Va rugam sa urmariti acest canal pentru a primi toate informatiile in timp real. Orice persoana care urmareste canalul poate vedea informatiile postate de noi, dar informatiile dumneavoastra (telefon, nume, foto) nu sunt vizibile pentru celelalte persoane, asigurand astfel confidentialitatea datelor dvs.' },
      { highlight: false, label: 'Informații și prin SMS, email, site, Facebook', text: 'De asemenea, in functie de situatie, vor fi transmise informatii si prin sms, e-mail, pe site-ul www.scoaladepatinaj.com si pe pagina de Facebook a Scolii de Patinaj (https://www.facebook.com/ScoaladePatinaj).' },
      { highlight: true,  label: 'Înscrierea = acceptarea regulamentului', text: 'Prin inscrierea la cursul de patinaj, parintii/tutorii confirma ca au inteles si acceptat toate aceste conditii.' },
    ],
  },
];

async function seedRegulations() {
  console.log('Seeding course regulations...');

  const existing = await strapi.documents('api::course-regulations.course-regulations').findFirst();
  if (existing) {
    console.log('Course regulations already exist — skipping. Delete them in the admin panel first to re-seed.');
    return;
  }

  await strapi.documents('api::course-regulations.course-regulations').create({
    data: { categories: CATEGORIES },
  });

  const totalRules = CATEGORIES.reduce((sum, c) => sum + c.rules.length, 0);
  console.log(`Done: ${CATEGORIES.length} categories, ${totalRules} rules`);
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    await seedRegulations();
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }

  await app.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
