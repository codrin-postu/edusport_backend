# Admin copy audit (read-only), edusport_backend, branch main

Paths are relative to `src/`. A row tagged `[xN]` covers N separate texts of the same pattern (line numbers listed). Verdicts: REMOVE, ICON, SHORTEN. KEEP rows are not listed. Proposals follow the user rules (diacritics, no em/en dash, no middle dot, no emoji, straight quotes). Where a proposal is "-" the element is deleted.

## Înscrieri

| file:line | where it shows | current text | verdict | proposal |
|---|---|---|---|---|
| admin/dashboard/InscrieriPage.tsx:160 | Înscrieri list, page subtitle | Cererile trimise prin formularul public de înscriere. | REMOVE | - |
| admin/dashboard/InscrieriPage.tsx:162 | Înscrieri list, empty state | Nicio înscriere pentru filtrul curent. | SHORTEN | Nicio înscriere. |
| admin/dashboard/InscrieriPage.tsx:165 | Înscrieri list, delete confirm body | Ștergi definitiv această înscriere și documentele ei? Acțiunea nu poate fi anulată. | SHORTEN | Ștergi înscrierea și documentele ei? Nu se poate anula. |
| club/inscrieri-copy.ts:6 | Înscrieri list, search placeholder | Caută după nr. înscriere, nume, părinte, email sau telefon... | SHORTEN | Nume, nr., telefon, e-mail |
| club/inscrieri-copy.ts:38 | Înscrieri panel, "Anulezi confirmarea?" body | Se anulează legătura cu fișa, grupa adăugată și statusul A.C.S. scris la confirmare. | SHORTEN | Se anulează legătura cu fișa, grupa și statusul A.C.S. |
| club/inscrieri-copy.ts:55 | Înscrieri panel, match card | În formular: nu a participat sezonul trecut. | SHORTEN | Nu a participat sezonul trecut. |
| club/inscrieri-copy.ts:60,62 (+ admin/dashboard/SubmissionTable.tsx:666) | Înscrieri panel, toast after Salvează | Salvat. Documentul a fost refăcut. / Salvat. Documentul PDF nu a putut fi refăcut. | SHORTEN | Salvat. Documentul refăcut. / Salvat. PDF-ul nu s-a refăcut. |
| club/inscrieri-copy.ts:72 | Confirm window, "Sportiv existent" option | Înscrierea se adaugă la această fișă | REMOVE | - (option label and the matched athlete say it) |
| club/inscrieri-copy.ts:74 | Confirm window, "Sportiv nou" option | Se creează o fișă nouă: {nume} | SHORTEN | Fișă nouă: {nume} |
| club/inscrieri-copy.ts:75 | Confirm window, validation under athlete choice | Alege "Sportiv existent" sau "Sportiv nou" | SHORTEN | Alege una dintre cele două. |
| club/inscrieri-copy.ts:82 (+ club/sportivi/search-view.ts:6) | Confirm window and athlete search, placeholder | Nume, data nașterii, părinte sau telefon | SHORTEN | Caută sportiv |
| club/inscrieri-copy.ts:91 | Confirm window, season part heading | Abonament dorit (din formular) | SHORTEN | Abonament dorit |
| club/inscrieri-copy.ts:103 (+ club/athletes/confirm-read.ts:81) | Confirm window, season part when no season | Se leagă doar fișa sportivului. | SHORTEN | Fără sezon, doar fișa. |
| club/registration-panel.ts:99,126,127 | Înscrieri panel, Documente tab, e-mail status line | Urmează să fie trimis / Netrimis / Nu s-a putut trimite. / Urmează să fie trimis. | ICON | Status icon (clock, warning) with aria-label "Urmează" / "Netrimis" / "Nu s-a putut trimite" |
| club/registration-panel.ts:135 | Înscrieri panel, Documente tab, under failed status | Apasă Retrimite sau verifică adresa. | REMOVE | - (the Retrimite button is right there) |
| club/athletes/errors.ts:6,8,17 (+ club/presence/copy/core.ts:8) | Înscrieri confirm and any failed action, error | Confirmarea nu a reușit. Nimic nu a fost salvat. / Data nașterii nu poate fi citită. Corectați-o în Date. / Acțiunea nu a reușit. Nimic nu a fost salvat. | SHORTEN | Confirmarea a eșuat. / Corectează data nașterii în Date. / Nu s-a salvat nimic. |

## Sportivi

| file:line | where it shows | current text | verdict | proposal |
|---|---|---|---|---|
| club/sportivi/list-view.ts:42 | Sportivi list, page subtitle | Toți sportivii clubului. Doar în panou, nu sunt publici. | REMOVE | - |
| club/sportivi/list-view.ts:47 | Sportivi list, empty state | Niciun sportiv nu corespunde filtrelor. | SHORTEN | Niciun sportiv. |
| club/sportivi/list-view.ts:44 | Sportivi list, search placeholder | Caută după nume, părinte, telefon, e-mail sau nr. înscriere... | SHORTEN | Nume, telefon, e-mail, nr. |
| club/sportivi/record-view.ts:19 (admin/dashboard/sportivi/DateTab.tsx:165) | Fișă sportiv, Date tab, line under the form | Obligatorii pentru "complet": nume, data nașterii, persoana de contact, telefon, e-mail. | REMOVE | Star on the five required labels |
| club/sportivi/search-view.ts:17 (admin/dashboard/sportivi/AddAthleteDialog.tsx:24,27,30) | Adaugă sportiv dialog, under 3 inputs [x3] | Opțional | REMOVE | - (star only on required fields) |
| club/portal/access/copy.ts:28,29 (admin/dashboard/sportivi/DateTab.tsx:117) | Fișă sportiv, Date tab, line under e-mail field [x2] | Accesul în portal trece la {e-mail}. / Accesul în portal se oprește. | ICON | Info icon beside the field, tooltip "Accesul trece la {e-mail}." / "Accesul se oprește." |
| club/sportivi/record-view.ts:43 (admin/dashboard/sportivi/ProfileEditor.tsx:579) | Fișă sportiv, Profil public, under Nume | Numele se schimbă în Date. | ICON | Lock icon on the read-only name, tooltip "Se schimbă în Date." |
| club/sportivi/record-view.ts:44 (admin/dashboard/sportivi/ProfileTab.tsx:46) | Fișă sportiv, Profil public tab, note | Datele de contact și data nașterii nu ajung niciodată aici. | REMOVE | - |
| admin/dashboard/sportivi/ProfileEditor.tsx:589,594 | Profil public editor, Text poveste [x2: hint and placeholder] | Fiecare rând nou devine un paragraf pe site. / Fiecare rând devine un paragraf. | REMOVE | - |
| club/sportivi/record-view.ts:38 | Fișă sportiv, "Ștergi sportivul?" body | "{nume}" se șterge definitiv, împreună cu profilul public, rezultatele și sezoanele. Înscrierile rămân, fără legătură. Acțiunea nu poate fi anulată. | SHORTEN | "{nume}" se șterge cu profilul public, rezultatele și sezoanele. Înscrierile rămân, fără legătură. Nu se poate anula. |
| club/presence/copy/lifecycle.ts:59 | Delete refused dialog | Sportivul are 2 plăți și 1 abonament. Ștergerea este blocată cât timp există plăți sau abonamente. | SHORTEN | Sportivul are 2 plăți și 1 abonament, deci nu se poate șterge. |
| club/presence/copy/lifecycle.ts:51 | Delete refused dialog, second line | Poți anonimiza sportivul în schimb: numele și datele personale se șterg, sumele plăților rămân. | SHORTEN | Îl poți anonimiza: datele personale se șterg, plățile rămân. |
| club/personal-data/copy.ts:16,17,18 | Anonimizează dialog body [x3 sentences] | Se șterg: numele, data nașterii, contactul, telefonul, e-mailul, notele, datele din înscrieri, documentele PDF, adresele din coada de e-mail, valorile vechi din Istoric și profilul public. Rămân: grupele pe sezoane, statusul A.C.S. și numărul de înscrieri. Acțiunea nu poate fi anulată. | SHORTEN | Se șterg datele personale, PDF-urile și profilul public. Rămân grupele pe sezoane, statusul A.C.S. și numărul de înscrieri. Nu se poate anula. |
| club/portal/access/copy.ts:26 | Fișă sportiv, Cont portal, "Dezactivează tot" confirm | Dezactivezi tot contul lui {nume}? Toate dispozitivele vor fi deconectate, și pe sportiv. | SHORTEN | Dezactivezi tot contul lui {nume}? Toate dispozitivele se deconectează. |
| club/portal/copy-admin.ts:27 | Cont portal block (coach and athlete) | Partea de antrenor e dezactivată. Accesul de părinte rămâne activ. | SHORTEN | Antrenor dezactivat. Accesul de părinte rămâne. |
| club/sportivi/merge-view.ts:21 | Unește dialog confirm | Rămâne fișa "{nume}". Cealaltă se șterge. Acțiunea nu poate fi anulată. | SHORTEN | Rămâne fișa "{nume}". Cealaltă se șterge. Nu se poate anula. |
| club/tables/copy.ts:62 | Tabele, empty result | Niciun rând pentru alegerile astea. | SHORTEN | Niciun rând. |
| club/tables/copy.ts:4 | Tabele, save view error | Există deja o vizualizare cu numele ăsta. | SHORTEN | Numele e deja folosit. |
| club/tables/copy.ts:81,82 (+ club/tables/query.ts:9) | Tabele, error notice [x2] | Tabelul are peste 5.000 de rânduri. Restrânge sfera sau filtrele. / Tabelul durează prea mult. Restrânge sfera. | SHORTEN | Peste 5.000 de rânduri. Adaugă filtre. / Prea lent. Restrânge sfera. |
| club/tables/copy.ts:90,91,92 | Tabele, notice on opened saved view [x3] | O coloană nu mai există și a fost scoasă. / Un filtru nu mai există și a fost scos. / Gruparea nu mai există și a fost scoasă. | SHORTEN | Coloană scoasă. / Filtru scos. / Grupare scoasă. |
| club/tables/copy.ts:30 (admin/dashboard/sportivi/tabele/ExportMenu.tsx:22) | Tabele, Exportă menu note | Exact ce vezi: 12 rânduri, 5 coloane, cu filtrele aplicate | SHORTEN | 12 rânduri, 5 coloane |

## Grupe

| file:line | where it shows | current text | verdict | proposal |
|---|---|---|---|---|
| club/groups/copy/grupe-ui.ts:29 (admin/dashboard/grupe/GroupDialog.tsx:43) | Grupă dialog, Program public switch description | Programul apare în calendarul de pe site. | REMOVE | - |
| club/groups/copy/grupe-ui.ts:26 (GroupDialog.tsx:37, ProgramDrawer.tsx:52, DatePanel.tsx:34) | Grupă dialog and program/date panels, under inputs [x3] | Opțional | REMOVE | - |
| club/groups/copy/grupe-ui.ts:37 | Grupă menu, delete confirm | Ștergi grupa "{nume}"? Acțiunea nu poate fi anulată. | SHORTEN | Ștergi grupa "{nume}"? Nu se poate anula. |
| club/groups/copy/grupe-ui.ts:101 | Grupă, Program tab, empty month | Nimic programat în această lună. | SHORTEN | Nimic programat. |
| club/groups/copy/grupe-ui.ts:102 | Grupă, Istoric tab, empty | Niciun rând în istoric. | SHORTEN | Niciun eveniment. |
| club/groups/copy/schedule.ts:7 (via club/groups/occurrences.ts:61, PanelShell aside) | Grupă, date panel, aside for a group event | Evenimentul aparține grupei {grupa}. Se schimbă din pagina grupei. | SHORTEN | Eveniment al grupei {grupa}. |
| club/groups/copy/schedule.ts:8 | Grupă, error when changing the group of an event | Grupa unui eveniment se schimbă din pagina grupei. | SHORTEN | Se schimbă din pagina grupei. |
| club/groups/copy/schedule.ts:6 (+ club/season-admin.ts:20 already short, admin/dashboard/AnuntEditPage.tsx:154) | Program drawer, validation | Data de sfârșit trebuie să fie după data de început. | SHORTEN | Sfârșitul trebuie să fie după început. |
| club/groups/copy/core.ts:15 | Grupă, Program, edit of a date with saved attendance | Data are prezența salvată. Poți doar să o anulezi. | SHORTEN | Prezență salvată, se poate doar anula. |
| club/groups/copy/calendar-ui.ts:19 | Program, Pauze, break impact preview | Lecțiile individuale și competițiile rămân. | REMOVE | - |
| club/groups/copy/new-season.ts:13 | Sezon nou wizard, step 1 lead | {next} devine sezonul curent. Se aplică abia la ultimul pas. | SHORTEN | {next} devine sezonul curent la ultimul pas. |
| club/groups/copy/new-season.ts:16 | Sezon nou wizard, step 2 lead | Toate grupele trec în {next}. Alege ce copiezi din {current}. | SHORTEN | Grupele trec în {next}. Alege ce copiezi din {current}. |
| club/groups/copy/new-season.ts:37 (admin/pages/sezoane/NewSeasonSteps.tsx:136) | Sezon nou wizard, step 2 muted line | Grupa principală rămâne aceeași dacă se copiază și ea. Altfel devine principală grupa copiată. | REMOVE | - (step 3 already states how many mains change) |
| club/groups/copy/new-season.ts:39,45 | Sezon nou wizard, step 3 tile captions [x2] | toate trec în {next} / grupa din {current} propusă | REMOVE | - |
| club/groups/copy/new-season.ts:53 | Sezon nou wizard, step 3 summary | ... Pauzele nu se copiază: adaugă vacanțele în Calendar și serii. | SHORTEN | ... Pauzele nu se copiază. |
| club/groups/copy/new-season.ts:54,55 | Sezon nou wizard, step 3 summary | Membru A.C.S. nu se copiază. În {next} toți pornesc de la Nu. | SHORTEN | Membru A.C.S. nu se copiază, toți pornesc de la Nu. |
| club/groups/copy/new-season.ts:56 | Sezon nou wizard, step 3 warning | Grupele Școlii nu au program în {next}: pagina Program arată textul vechi până îl adaugi. | SHORTEN | Grupele Școlii nu au program în {next}. Pagina Program arată textul vechi. |
| club/groups/copy/new-season.ts:75-81 | Sezon nou wizard, "Ce se schimbă" list [x7] | e.g. Calendar: Nu se schimbă. Arată fiecare dată din programul grupelor, din ambele sezoane. / {current}: Rămâne de citit în Grupe, nu se mai modifică. / Membru A.C.S.: Pe sezon, nu se copiază. În {next} toți pornesc de la Nu. | SHORTEN | Calendar: Nu se schimbă. / {current}: Doar citire. / Membru A.C.S.: Toți pornesc de la Nu. / Formular pe hârtie: Sezonul {next}. / Grupe, Sportivi: Se deschid pe {next}. (drop the Înscrieri and Program explanations or cut to one clause) |
| admin/pages/SezoanePage.tsx:59 | Sezoane page, subtitle | Sezoanele școlii, taxa de membru și sezonul curent. | REMOVE | - |
| admin/pages/SezoanePage.tsx:39 | Sezoane page, under table | Clic pe un rând deschide editarea lui într-un panou lateral. | REMOVE | - |
| admin/pages/sezoane/SeasonDrawer.tsx:12 (club/season-admin.ts:23) | Sezon drawer, under Sezon field | Sezonul are înscrieri. / Sezonul are înscrieri, numele lui nu se mai schimbă. | ICON | Lock icon on the field, tooltip "Are înscrieri, nu se mai schimbă." |

## Prezență

| file:line | where it shows | current text | verdict | proposal |
|---|---|---|---|---|
| club/presence/copy/prezenta-ui.ts:6 | Prezență page, subtitle | Ședințe și prezențe pe grupe | REMOVE | - |
| club/presence/copy/prezenta-ui.ts:9 | Prezență page, warning notice | Setează data de început a prezenței în Setări site. | SHORTEN | Setează data de început în Setări site. |
| club/presence/copy/core.ts:42 (shown in PrezentaScreen.tsx:38 and DeIncasatList.tsx:80) | Prezență and De încasat, notice | 2 grupe fără listă de prețuri: prezența se înregistrează, nimic nu se calculează. | SHORTEN | 2 grupe fără listă de prețuri, fără sume calculate. |
| club/presence/copy/prezenta-ui.ts:12,13,36,37,38,56 (+ :21) | Prezență list, month and period screens, coach page, empty states [x7] | Nicio ședință în ziua asta. / Nicio lecție individuală în luna asta. / Nicio ședință în perioada asta. / Nicio oră în perioada asta. | SHORTEN | Nicio ședință. / Nicio lecție. / Nicio oră. |
| club/presence/copy/prezenta-ui.ts:23 (admin/pages/SetariSitePage.tsx:145) | Setări site, under "Prezență și plăți din" | Ședințele dinainte nu apar ca nefăcute. | REMOVE | - |
| club/presence/copy/attendance.ts:33 | Prezență, reactivate dialog | {nume} are statusul Inactiv. Reactivezi sportivul? | SHORTEN | {nume} este inactiv. Reactivezi? |
| club/presence/copy/core.ts:7 (+ athletes/errors.ts:13, price-admin.ts:44, new-season.ts:66, subscriptions.ts:30) | Any stale-data error [x5] | Datele s-au schimbat. Reîncarcă pagina. | SHORTEN | Datele s-au schimbat. Reîncarcă. |

## Bani

| file:line | where it shows | current text | verdict | proposal |
|---|---|---|---|---|
| club/presence/copy/money-ui.ts:24 (admin/dashboard/ContabilitatePage.tsx:114) | Contabilitate, Plăți tab, sub-heading | Încasate în noiembrie | REMOVE | - (month switcher shows it) |
| club/presence/copy/money-ui.ts:86 | Contabilitate, Pe grupe tab, sub-heading | Datorat și încasat pe secțiuni, grupe și metode de plată | REMOVE | - |
| club/presence/copy/money-ui.ts:82 (admin/dashboard/bani/RestanteTab.tsx:102) | Contabilitate, Restanțe, Școala block | Toate abonamentele neachitate integral | REMOVE | - |
| club/presence/copy/money-ui.ts:65 (admin/dashboard/bani/BaniBreakdown.tsx:62) | Contabilitate, Pe grupe, under table | Încasat aici: plătit din ce s-a datorat în luna asta. | ICON | Info icon on the "Încasat" column header, tooltip "Plătit din ce s-a datorat în luna asta." |
| club/presence/copy/money-ui.ts:32 (+ payments.ts:63) | De încasat, empty | Nimic de încasat în luna asta. | SHORTEN | Nimic de încasat. |
| club/presence/copy/payments.ts:21 (admin/dashboard/bani/PaymentWindow.tsx:73) | Plată window, line under amount | orice sumă | REMOVE | - |
| club/presence/copy/payments.ts:25 (admin/dashboard/bani/PaymentWindow.tsx:98) | Plată window, Notă field | Opțional | REMOVE | - |
| club/presence/copy/payments.ts:29 | Plată window, next to "Trimite e-mail" | Sportivul nu are e-mail. | SHORTEN | Fără e-mail. |
| club/presence/copy/payments.ts:31 | Plată window, validation | Suma trebuie să fie mai mare decât 0. | SHORTEN | Suma trebuie să fie peste 0. |
| club/presence/copy/payments.ts:41 | Plată, cancel confirm | Anulezi plata de {sumă} din {data}? Rândul rămâne, marcat anulată. | SHORTEN | Anulezi plata de {sumă} din {data}? Rămâne marcată anulată. |
| club/presence/copy/subscriptions.ts:27 (admin/dashboard/bani/ExtendModal.tsx:62) | Prelungește abonamentele modal | Se prelungesc 12 abonamente active cu 2 săptămâni. Noua dată de expirare se calculează pentru fiecare. | SHORTEN | Se prelungesc 12 abonamente active cu 2 săptămâni. |
| club/presence/copy/subscriptions.ts:35 | Adaugă abonament window, note | Abonamentul actual rămâne valabil. Următorul, la prețul Avansați Gold. | SHORTEN | Următorul abonament, la prețul Avansați Gold. |

## Prețuri

| file:line | where it shows | current text | verdict | proposal |
|---|---|---|---|---|
| admin/pages/PreturiPage.tsx:60 | Prețuri page, subtitle | Listele de prețuri pe secțiuni. | REMOVE | - |
| admin/pages/preturi/PriceNotesCard.tsx:45 | Prețuri, Notițe subsol card | Textele afișate în subsolul secțiunii de prețuri de pe site. | REMOVE | - |
| admin/pages/preturi/PriceListCard.tsx:57 | Prețuri, under list table | * are tooltip. Clic pe rând pentru editare. | REMOVE | - |
| admin/pages/preturi/PriceListCard.tsx:20 | Prețuri, row marker next to a price with tooltip | * | ICON | Info icon, aria-label and tooltip hold the tooltip text |
| admin/pages/preturi/PriceListCard.tsx:47 | Prețuri, list card, banner above table | Preț incomplet | REMOVE | - (rows already carry the "Lipsă" badge, line 9) |
| admin/pages/preturi/PriceItemDrawer.tsx:46 | Preț drawer, Tooltip field | Opțional | REMOVE | - |

## Program

| file:line | where it shows | current text | verdict | proposal |
|---|---|---|---|---|
| admin/dashboard/ProgramEditPage.tsx:19 | Program page, subtitle | Calendarul sezonului și seriile de cursuri | REMOVE | - |
| admin/pages/PaginaProgramPage.tsx:103 | Pagina Program (site content), subtitle | Bannerul, subtitlul orarului și notificările de pe pagina /cursuri/program | REMOVE | - |
| admin/pages/PaginaProgramPage.tsx:116,117 (+ plugins/component-preview/admin/src/CalendarLink.tsx:22) | Pagina Program, "Calendar și serii" link card [x2] | Calendarul sezonului și seriile de curs se editează în pagina Program, nu aici. / Aici poți edita datele pentru școala de patinaj și alte evenimente. | SHORTEN | Se editează în pagina Program. (one line, drop the body) |
| admin/pages/PaginaProgramPage.tsx:124,142,170 | Pagina Program, card descriptions [x3] | Titlul și subtitlul afișate în banner-ul... / Subtitlul orarului afișat pe /cursuri/program. Etichetele și datele de sezon sunt setate global în Setări Site. / Notificările afișate pe pagina Program, în ordinea de aici. | REMOVE | - |
| admin/pages/PaginaProgramPage.tsx:128,132,149 | Pagina Program, hints under inputs [x3] | Titlul mare afișat în banner / Textul descriptiv de sub titlu / Textul de sub titlul secțiunii de orar | REMOVE | - |
| admin/pages/PaginaProgramPage.tsx:155-163 | Pagina Program, info notice | Etichetă și date sezon: Setate o singură dată în Setări Site → Înscrieri & Sezon. Apar automat pe pagina Program și în calendar. | SHORTEN | Etichetă și date sezon. Se setează în Setări site. (keep the link button) |

## Anunțuri

| file:line | where it shows | current text | verdict | proposal |
|---|---|---|---|---|
| admin/dashboard/AnunturiPage.tsx:281 (+ AnuntEditPage.tsx:406) | Anunțuri list and editor, subtitle [x2] | Anunțuri pe site și pe portalul sportivilor. | REMOVE | - |
| admin/dashboard/AnunturiPage.tsx:271 | Anunțuri list, Umami error | Nu am putut citi vizualizările din Umami. Restul paginii funcționează normal. | SHORTEN | Vizualizările nu s-au încărcat. |
| admin/dashboard/AnunturiPage.tsx:314 | Anunțuri list, empty | Niciun anunț încă. Apasă "+ Anunț nou" ca să creezi primul. | SHORTEN | Niciun anunț încă. |
| admin/dashboard/AnuntEditPage.tsx:530 | Anunț editor, Mesaj placeholder | Două-trei rânduri. Text simplu, fără formatare. | REMOVE | - |
| admin/dashboard/AnuntEditPage.tsx:535 | Anunț editor, read-only technical field | Id de urmărire (Umami): {slug} | REMOVE | - (technical, no value for the editor) |
| admin/dashboard/AnuntEditPage.tsx:149,150,153 | Anunț editor, validation [x3] | Titlul anunțului este obligatoriu. / Mesajul anunțului este obligatoriu. / Un anunț are nevoie de o dată de început și una de final. | SHORTEN | Completează titlul. / Completează mesajul. / Alege data de început și de final. |
| admin/dashboard/AnuntEditPage.tsx:600 | Anunț editor, delete confirm detail | Dacă vrei doar să nu mai apară pe site, treci-l pe Inactiv: rămâne în listă cu statisticile lui. | SHORTEN | Ca să nu mai apară, treci-l pe Inactiv. |
| admin/dashboard/AnuntEditPage.tsx:599 | Anunț editor, delete confirm body | "{titlu}" se șterge definitiv. Acțiunea nu poate fi anulată. | SHORTEN | "{titlu}" se șterge. Nu se poate anula. |
| club/anunturi/portal-history.ts:38 | Anunțuri, row of an automatic message, stop control | Mesajele automate nu se pot opri. | ICON | Lock icon in place of the stop button, tooltip "Automat, nu se poate opri." |

## Setări

| file:line | where it shows | current text | verdict | proposal |
|---|---|---|---|---|
| admin/pages/SetariSitePage.tsx:163 | Setări site, subtitle | Înscrieri și date de contact, folosite pe tot site-ul. | REMOVE | - |
| admin/pages/SetariSitePage.tsx:123 | Setări site, Date de contact card description | Informații afișate în footer-ul site-ului și pe paginile de contact. Modificările se reflectă pe tot site-ul. | REMOVE | - |
| admin/pages/SetariSitePage.tsx:82,86,87 | Setări site, hints under phone, WhatsApp, address [x3] | Cu sau fără spații, link-ul tel: se generează automat / Link către canalul de WhatsApp / Textul adresei care apare pe site | REMOVE | - |
| admin/pages/SetariSitePage.tsx:91 (+ plugins/component-preview/admin/src/SiteSettingsContactEditor.tsx:122) | Setări site, hint under Link hartă | Lasă gol și adresa duce automat la o căutare Google Maps. Completează doar dacă vrei un loc anume: deschide locația în Google Maps, apasă Partajează, copiază linkul. | ICON | Help icon, tooltip "Gol: căutare Google Maps. Altfel lipește linkul din Partajează." |
| admin/pages/SetariSitePage.tsx:103 | Setări site, Înscrieri deschise, hint under switch | Când este activ, pe site se afișează secțiunea de înscrieri. Când este inactiv, apare mesajul că înscrierile sunt închise. | REMOVE | - |
| admin/pages/SetariSitePage.tsx:110,111 | Setări site, Înscrieri deschise, beside switch [x2] | Vizibile pe site / (HelpTip) Comută starea de înscrieri afișată public pe site. | REMOVE | - (the switch has the label and state) |
| club/security/copy.ts:113 | Securitate, backup codes window | Fiecare cod merge o singură dată. Păstrează-le, nu le mai arătăm. | SHORTEN | Fiecare cod merge o dată. Nu se mai afișează. |
| club/security/copy.ts:156 | Securitate, Google section | Pornește 2-Step Verification în contul Google. | REMOVE | - |
| admin/dashboard/SheetsDialog.tsx:285 | Google Sheets dialog, link error | Link invalid. Copiază adresa din bara browserului, cu foaia deschisă. | SHORTEN | Link invalid. Copiază adresa foii din browser. |
| admin/dashboard/SheetsDialog.tsx:337 | Google Sheets dialog, toast | Foaie nouă creată. Nu am putut-o partaja automat, deschide-o din link. | SHORTEN | Foaie creată, dar nepartajată. Deschide-o din link. |
| admin/dashboard/SheetsDialog.tsx:371 | Google Sheets dialog, toast | Foaia a fost deconectată. Datele din foaie rămân neatinse. | SHORTEN | Foaie deconectată. |
| admin/dashboard/SheetsDialog.tsx:398 | Google Sheets dialog, error | Ritmul verificării nu poate fi salvat încă: serverul nu are endpointul de programare. | SHORTEN | Ritmul nu s-a putut salva. |
| admin/dashboard/SheetsDialog.tsx:448-450 | Google Sheets dialog, hint above service account address | Foaia trebuie partajată cu drepturi de editor către adresa contului de serviciu (generată de Google la crearea contului): | SHORTEN | Partajează foaia ca editor cu adresa: |
| admin/dashboard/SheetsDialog.tsx:472-473 | Google Sheets dialog, "Foaie nouă" notice | Creată de contul de serviciu și partajată cu adresa ta, ca să apară în Google Drive. | REMOVE | - |
| admin/dashboard/SheetsDialog.tsx:561-563 | Google Sheets dialog, hint under interval | Trimiterile ajung în foaie imediat. Verificarea compară foaia cu baza de date și repară ce a lipsit, dacă Google a fost indisponibil. ("Oprit" oprește doar verificarea periodică...) | SHORTEN | Verificarea compară foaia cu baza de date și repară diferențele. |
| admin/dashboard/SheetsDialog.tsx:604 | Google Sheets dialog, under run log | Se păstrează ultimele 20 de rulări per formular. | REMOVE | - |
| admin/dashboard/SheetsDialog.tsx:630 | Google Sheets dialog, status line when not connected | Trimiterile sunt scrise automat într-o foaie de calcul. | REMOVE | - |
| admin/dashboard/SheetsDialog.tsx:643 | Google Sheets dialog, disconnect confirm | Nu mai trimitem nimic către "{foaie}". Foaia și datele din ea rămân neatinse. | SHORTEN | Nu se mai trimit date către "{foaie}". Foaia rămâne neatinsă. |

## Altele (site content editors, forms, dashboard, shared UI)

| file:line | where it shows | current text | verdict | proposal |
|---|---|---|---|---|
| admin/pages/CursuriPage.tsx:187,200,230,281,320 (also RegulamentPage.tsx:180,193,209; RealizariPage.tsx:88,101,119,144,151,152; IstoricPage.tsx:111,124,142,177,190; PaginaEchipaPage.tsx:60,73,91; PaginaParteneriPage.tsx:84,117,118,126,127; EvenimentColaborareEditPage.tsx:125,143,162; EvenimenteColaborarePage.tsx:108; MomenteIstoricPage.tsx:212; DisciplinePage.tsx:135) | Site content pages, page subtitle and card descriptions [x33] | e.g. Titlul și subtitlul afișate în bannerul din partea de sus a paginii. / Prezentarea școlii de patinaj: titlu, text descriptiv, puncte cheie și link video opțional. / Competițiile și rezultatele sportivilor sunt gestionate separat, ca înregistrări individuale, organizate pe sezoane. | REMOVE | - (card title and field labels say it; for the link cards keep only the button) |
| admin/pages/CursuriPage.tsx:211,215,216,217,221,239,240,249,253,259,266,273,289,290,294,302,323,333 | Pagina Cursuri editor, hints under inputs [x18] | e.g. Titlul mare afișat pe banner-ul paginii, ex: Cursuri de Patinaj / ex: Sâmbătă & Duminică / URL YouTube sau alt video, opțional / Textul final afișat după lista de sfaturi, opțional | REMOVE | - (placeholder already carries the example; star marks required) |
| admin/pages/CursuriPage.tsx:244,310,327 | Pagina Cursuri editor, format hints [x3] | Descrierea principală. Separă paragrafele cu o linie goală. / Câte un punct pe rând / Câte un sfat sau regulă pe rând | SHORTEN | Câte un paragraf pe rând. / Câte unul pe rând. (keep only where the format is not obvious) |
| admin/pages/IstoricPage.tsx:128,132,146,147,151; PaginaEchipaPage.tsx:77,81,98; RegulamentPage.tsx:197,201,237; RealizariPage.tsx:105,109; EvenimentColaborareEditPage.tsx:149,152,167 | Banner and intro fields on other pages, hints under inputs [x16] | e.g. Titlul mare afișat în banner / Textul descriptiv de sub titlu / Pictograma afișată lângă titlul categoriei (fără alegere: Layers) / Text liber, afișat exact cum este scris / Evenimentele apar pe /parteneri în ordine crescătoare după acest număr. | REMOVE | - |
| admin/pages/IstoricPage.tsx:162 | Istoric page, card description | Valorile afișate în grilă (ex: "10+\|Competiții pe an"). Format: valoare\|etichetă, câte una pe rând. | SHORTEN | Format: valoare\|etichetă, câte una pe rând. |
| plugins/component-preview/admin/src/ (CursuriPage*Editor.tsx, HistoricPageInfoEditor.tsx, PageBannerEditor.tsx, TeamPageInfoEditor.tsx, ProgramPageInfoEditor.tsx, RealizariPageBannerEditor.tsx, VolunteerContentEditor.tsx, SiteSettingsContactEditor.tsx, VideoEmbedEditor.tsx:316, CalendarEventsEditor.tsx:606,643,774,1098,1173,1186,1199, RulesTable.tsx:120, ScheduleGroupsEditor.tsx:160, PartnersLinksEditor.tsx, PartnersContentEditor.tsx:91, VolunteerHelpWaysEditor.tsx:65, SiteSettingsRegistrationEditor.tsx:47) | Strapi-native editors (legacy duplicates of the custom pages above), same hints and descriptions [x~50] | same sentences as the custom pages, plus "Afișată în card-ul de hover. Suportă markdown." x5 | REMOVE | Same cut as on the custom pages. If these editors are no longer reachable, remove the copy with them. |
| admin/dashboard/HomepageEditPage.tsx:579,592,615,707,764 | Pagina principală, subtitle and card descriptions [x5] | Textele de pe prima pagină a site-ului / Titlul EDUSPORT și fundalul video nu se editează, fac parte din design. / Pe site apare o singură variantă. / Layout-ul e construit pentru exact 3 panouri. Un al patrulea nu s-ar afișa. / Pagina Istoric are deocamdată lista ei separată de cifre... | REMOVE | - (707 may become "Exact 3 panouri.") |
| admin/dashboard/HomepageEditPage.tsx:602-610 | Pagina principală, "Evenimentul următor" notice | Se ia automat din Noutăți, primul eveniment care nu a trecut. Când nu urmează niciunul, eticheta nu se afișează. | SHORTEN | Se ia automat din Noutăți. |
| admin/dashboard/HomepageEditPage.tsx:616-630 | Pagina principală, "Sezonul și starea înscrierilor" notice | Acum înscrierile sunt deschise, deci site-ul afișează varianta "deschise". Se schimbă din Setări site. | SHORTEN | Înscrieri deschise. Se schimbă din Setări site. / Înscrieri închise. Se schimbă din Setări site. |
| admin/dashboard/HomepageEditPage.tsx:276,688 (emptyNote, 291) | Pagina principală, inherited field notes [x2] | Valoare scrisă doar pentru pagina principală. / Înainte câmpul era gol aici, deci butonul nu ducea nicăieri. | REMOVE | - |
| admin/dashboard/HomepageEditPage.tsx:751 | Pagina principală, Număr sportivi hint | Se actualizează când adaugi sau ascunzi un sportiv. | REMOVE | - |
| admin/dashboard/HomepageEditPage.tsx:766-769 | Pagina principală, "Cifrele se scriu o singură dată" notice | Lista de mai jos este comună. Bifează aici doar cifrele care apar pe pagina principală. Ordinea de pe site este ordinea din listă. | SHORTEN | Bifează cifrele care apar pe prima pagină. |
| admin/dashboard/HomepageEditPage.tsx:804-807 | Pagina principală, gallery notice | Secțiunea apare pe pagina principală doar dacă este aleasă cel puțin o imagine. Fără imagini, secțiunea nu se afișează deloc. | SHORTEN | Fără imagini, secțiunea nu apare. |
| admin/dashboard/HomepageEditPage.tsx:776 | Pagina principală, empty list | Nicio cifră în listă. Adaugă prima cifră a clubului. | SHORTEN | Nicio cifră. |
| admin/dashboard/NavigationPage.tsx:248 | Meniu page, subtitle | Descrierea și imaginea cardurilor din meniul de sus | REMOVE | - |
| admin/dashboard/NavigationPage.tsx:269 | Meniu page, hint under Descriere | Apare în lista care se deschide pe desktop, sub titlul cardului. | REMOVE | - |
| admin/dashboard/NavigationPage.tsx:263,264 | Meniu page, no editable card | Secțiunea are un card promo, dar el nu este încă înregistrat în administrare. Cere unui dezvoltator să îl adauge. / Secțiunea nu are card promo, deci nu are nimic de editat. Cardul apare doar la Despre Noi și Cursuri. | SHORTEN | Card promo neînregistrat. Cere unui dezvoltator. / Fără card promo, nimic de editat. |
| admin/dashboard/FormEditorPage.tsx:411 (+ :662) | Formular editor, Tip field | Tipul nu se mai poate schimba după adăugare. / tipul nu se poate schimba | ICON | Lock icon on the Tip field, tooltip "Nu se mai schimbă." |
| admin/dashboard/FormEditorPage.tsx:611 | Formular editor, Mod de afișare | Alege cum arată pe site. | REMOVE | - |
| admin/dashboard/FormEditorPage.tsx:389-391 | Formular editor, remove-question confirm | Un câmp încorporat își păstrează coloana și datele deja trimise în tabelul de rezultate și poate fi readus din lista câmpurilor scoase. | SHORTEN | Datele trimise rămân în rezultate. Îl poți readuce din lista câmpurilor scoase. |
| admin/dashboard/FormEditorPage.tsx:458-460 | Formular editor, under removed-fields list | Coloanele și datele deja trimise rămân în tabelul de rezultate, marcate "(eliminată)". Anulează pentru a readuce câmpul în formular la următoarea salvare. | SHORTEN | Datele trimise rămân în rezultate, marcate "(eliminată)". |
| admin/dashboard/FormEditorPage.tsx:451 | Formular editor, undo-remove tooltip | Anulează scoaterea (câmpul revine în formular la salvare) | SHORTEN | Anulează scoaterea |
| admin/dashboard/FormEditorPage.tsx:667-669 | Formular editor, warning on built-in field | Câmp încorporat. La ștergere dispare din formular, dar coloana și datele deja trimise rămân în tabelul de rezultate. | REMOVE | - (same sentence is in the delete confirm) |
| admin/dashboard/FormEditorPage.tsx:723,724-726 | Formular editor, option list hints [x2] | Opțiunile acestei liste sunt fixe; se pot redenumi și dezactiva. / Poți redenumi, reordona sau dezactiva opțiuni. Redenumirea nu schimbă datele deja trimise; o opțiune ștearsă cu date vechi rămâne vizibilă în rezultate. | ICON | One help icon on the list, tooltip "Redenumirea nu schimbă datele trimise." |
| admin/dashboard/SubmissionTable.tsx:1560 | Rezultate formular, column picker heading | Coloane: trage pentru a reordona, bifează ce se afișează | SHORTEN | Coloane |
| admin/dashboard/MesajePage.tsx:494 (+ ParteneriRezultatePage.tsx:13, VoluntariPage.tsx:305, FormularePage.tsx:95, formDefs.ts:53,69,89,105) | Inbox pages and Formulare cards, subtitle/description [x8] | Mesajele trimise din formularul public de contact. / Cererile de voluntariat trimise din pagina publică de voluntariat. / Formularele publice ale site-ului, cu răspunsurile primite și acces la rezultate. | REMOVE | - |
| admin/ui/InboxLayout.tsx:79 (+ MesajePage.tsx:533, FormResultsPage.tsx:453) | Inbox pages, empty reader pane [x3] | Selectează un element din listă. / Selectează un mesaj din listă pentru a-l citi. / Selectează o înregistrare din listă pentru a o citi. | REMOVE | - (empty pane) |
| admin/dashboard/MesajePage.tsx:526, FormResultsPage.tsx:446, VoluntariPage.tsx:308 | Inbox pages, empty list [x3] | Niciun mesaj pentru filtrul curent. / Nicio înregistrare pentru filtrul curent. / Nicio cerere pentru filtrul curent. | SHORTEN | Niciun mesaj. / Nicio înregistrare. / Nicio cerere. |
| admin/dashboard/MesajePage.tsx:296,549 | Mesaje, delete error and confirm detail (missing diacritics) [x2] | Stergerea nu a reusit. Incearca din nou. / Stergerea este definitiva. Datele expeditorului nu mai pot fi recuperate. | SHORTEN | Ștergerea nu a reușit. / Se șterge definitiv. |
| admin/dashboard/VoluntariPage.tsx:311 | Voluntari, delete confirm | Ștergi definitiv această cerere de voluntariat? Acțiunea nu poate fi anulată. | SHORTEN | Ștergi cererea? Nu se poate anula. |
| admin/dashboard/SponsoriPage.tsx:137,154,161 | Sponsor drawer, hints under Logo, Link, Ordine [x3] | Se afișează în banda de sponsori de pe pagina Parteneri. / Opțional. Lasă gol dacă logo-ul nu trebuie să ducă nicăieri. / Numărul mai mic apare primul. | REMOVE | - |
| admin/dashboard/SponsoriPage.tsx:424 | Sponsori list, subtitle | Logo-urile afișate pe pagina Parteneri. Apasă un rând pentru a edita. | REMOVE | - |
| admin/dashboard/MembriEchipaPage.tsx:592 | Membri echipă list, subtitle | Antrenorii afișați pe pagina Echipa. Apasă un card pentru a edita, trage-l pentru a schimba ordinea. | REMOVE | - |
| admin/dashboard/MembriEchipaPage.tsx:316 | Membru drawer, hint under Descriere | Apare sub nume, pe cardul din pagina Echipa. | REMOVE | - |
| admin/dashboard/MembriEchipaPage.tsx:191 | Membru drawer, empty categories | Nicio categorie aleasă. Membrul apare pe site fără lista "Predă la". | REMOVE | - |
| admin/dashboard/MembriEchipaPage.tsx:702-706, SponsoriPage.tsx:445 | Membri echipă and Sponsori lists, reorder locked [x2] | . Golește căutarea și filtrul pentru a putea reordona. / Golește căutarea pentru a putea reordona. | ICON | Disabled drag handle with lock icon, tooltip "Golește căutarea ca să reordonezi." |
| admin/dashboard/SponsoriPage.tsx:471, MembriEchipaPage.tsx:739 (admin/ui/GalleryGrid.tsx:221) | Delete confirm details for image/logo/photo [x3] | Logo-ul rămâne în biblioteca media. / Fotografia rămâne în biblioteca media. / Fișierul rămâne în biblioteca media. Modificarea se aplică după ce apeși Salvează. | REMOVE | - |
| admin/dashboard/VoluntariatEditPage.tsx:208 | Voluntariat editor, empty list | Niciun mod de a ajuta. Secțiunea nu apare pe site. | SHORTEN | Niciun mod de a ajuta. |
| admin/dashboard/VoluntariatEditPage.tsx:240,241 | Voluntariat editor, gallery info [x2] | Momentan nu există imagini, iar galeria nu apare pe site. / Imaginile apar în galeria de pe pagina publică, în ordinea de aici. | REMOVE | - |
| admin/dashboard/CompetitiiPage.tsx:355 | Competiții, subtitle | Importă o competiție după nume pentru a-i prelua rezultatele. Sportivii apar automat și pot fi conectați în editorul de sportiv. | SHORTEN | Importă o competiție după nume sau URL. |
| admin/dashboard/CompetitiiPage.tsx:177,181,184 | Competiții, import messages [x3] | Alege competiția de importat dintre rezultatele de mai jos: / Nicio potrivire găsită. Încearcă alt nume sau lipește direct URL-ul rezultatelor. / Căutarea a eșuat. Verifică numele/URL-ul și încearcă din nou. | SHORTEN | Alege competiția: / Nicio potrivire. Încearcă alt nume sau lipește URL-ul. / Căutarea a eșuat. Verifică numele sau URL-ul. |
| admin/dashboard/CompetitiiPage.tsx:323,430,445,446 | Competiții, tooltip, empty and connect notes [x4] | Recitește rezultatele din baza noastră de date / Nicio competiție importată încă. Importă una mai sus. / Nu am putut încărca lista sportivilor clubului, așa că nu putem spune cine a participat. Reîncarcă pagina. / Niciun sportiv conectat al clubului în această competiție. Conectează sportivii în editorul de sportiv. | SHORTEN | Recitește rezultatele / Nicio competiție importată. / Lista sportivilor nu s-a încărcat. Reîncarcă pagina. / Niciun sportiv conectat. |
| admin/dashboard/DashboardPage.tsx:488 | Acasă, Cereri empty state | Nimic nou. Totul e la zi. | ICON | Check icon with label "La zi" |
| admin/dashboard/DashboardPage.tsx:614,702 | Acasă, Umami and GlitchTip not connected [x2 bodies] | Lipsesc datele de acces către serviciul de statistici. / ...serviciul de erori. | REMOVE | - (title "Umami nu este conectat" is enough) |
| admin/dashboard/DashboardPage.tsx:619,707 | Acasă, service did not answer [x2] | Serviciul nu a răspuns. Datele reapar singure când revine. / Serviciul nu a răspuns. Asta nu înseamnă că site-ul are probleme. | SHORTEN | Serviciul nu răspunde. |
| admin/dashboard/DashboardPage.tsx:661 | Acasă, no visits yet | Statisticile apar după prima vizită pe site. Poate dura câteva minute. | SHORTEN | Încă nicio vizită. |
| admin/dashboard/DashboardPage.tsx:764,783 | Acasă, GlitchTip chart footnotes [x2] | Bara numără incidente după ultima apariție, nu numărul total de apariții. / Sunt afișate primele 100 de incidente, deci cifrele sunt un minim. | ICON | Help icon on the chart title, tooltips "După ultima apariție." / "Primele 100 de incidente." |
| admin/ui/RepeatableList.tsx:155 (callers: RegulamentPage.tsx:121,220, ProfileEditor.tsx:762, VoluntariatEditPage.tsx:213-214, HomepageEditPage.tsx:823) | Any repeatable list, delete confirm [x6] | Elementul dispare din listă după ce salvezi pagina. / Regula dispare din listă după ce salvezi pagina. / Categoria și toate regulile ei dispar după ce salvezi pagina. / Modificarea se aplică după ce apeși Salvează. | SHORTEN | Se șterge la salvare. (keep the extra clause only for categories: "Se șterge cu toate regulile ei.") |
| admin/ui/TimeInput.tsx:206 | Time picker popover | sau scrie ora direct în câmp | REMOVE | - |
| admin/ui/useUnsavedGuard.tsx:136 | Leave-page confirm | Dacă pleci de pe pagină acum, modificările nesalvate se pierd. | SHORTEN | Modificările nesalvate se pierd. |
| admin/ui/useSaveState.ts:108 | Any save, success toast | Modificările au fost salvate. | SHORTEN | Salvat. |
| admin/lib/contentApi.ts:249 | Any save, validation error | Datele nu sunt valide. Verifică câmpurile și încearcă din nou. | SHORTEN | Verifică câmpurile. |
| admin/dashboard/CompetitieEditPage.tsx:240, AnuntEditPage.tsx:329, SponsoriPage.tsx:270, MembriEchipaPage.tsx:509, sportivi/ProfileEditor.tsx:521 | Editors, save error [x5] | Salvarea a eșuat. Verifică datele și încearcă din nou. | SHORTEN | Nu s-a salvat. Verifică datele. |
| admin/MobileNav.tsx:254 | Mobile menu, Strapi menu empty | Meniul Strapi nu este încă disponibil. Reîncarcă pagina dacă persistă. | SHORTEN | Meniul nu s-a încărcat. Reîncarcă pagina. |
| admin/pages/ArticolEditPage.tsx:22, ArticolePage.tsx:20 | Articole pages, info card body [x2] | Până când pagina este gata, conținutul se editează în continuare în editorul Strapi. | SHORTEN | Se editează în editorul Strapi. |

## Notes

- Each admin and portal Romanian string from `club/*/copy*.ts`, `*-view.ts`, `inscrieri-panel.ts`, `athlete-data.ts`, `registration-panel.ts` was read; `athlete-data.ts` and `inscrieri-panel.ts` hold only field labels (no sentences), so they have no rows.
- Short "Nu am putut încărca X." load errors (about 40, one per page) are KEEP: they say what failed. Same for field validation errors that name the fix.
- Romanian text without diacritics found in `admin/dashboard/MesajePage.tsx:296,549` (listed above).
- The portal copy (`club/portal/*`) was skipped except `club/portal/access/copy.ts` and `club/portal/copy-admin.ts`, which feed the admin Sportivi and team screens. A separate portals audit exists in `copy-audit-portals.md`.

## Counts

Rows (a row may group texts of one pattern): REMOVE 65, ICON 13, SHORTEN 93, total 171.

Individual texts (counting each [xN] group): REMOVE 212, ICON 17, SHORTEN 138, total 367. Rows with several line numbers but no [xN] tag count as 1 here, so true totals are slightly higher.

KEEP rows skipped: about 150 (about 40 load-failed notices, about 45 validation and error strings that name the fix, about 30 toasts and undo lines in `club/groups/copy/core.ts` and `club/presence/copy`, about 25 dialog titles and confirms, plus security and sign-in copy).
