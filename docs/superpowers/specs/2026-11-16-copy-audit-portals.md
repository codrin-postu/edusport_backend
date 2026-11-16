# Copy audit: coach portal (antrenor) and athlete/parent portal (sportiv)

Source note: `main` has no portal code (only docs/portal). The portals live on `main-release` (tip 41572a6 area, same code as `feat/notices-tracking`, a superset of feat/portal, feat/sportiv, feat/coach-screens, feat/athletes, feat/coach-admin-scoala). This audit reads `main-release` through `git archive`; the working tree was not touched.

Line numbers are the definition line in `src/lib/portal/copy.ts` (coach), `copy-sportiv.ts` (sportiv), `copy-shared.ts` (shared). Screen files are under `src/app/`. Nearly all text is centralised in those three files; no inline Romanian paragraphs exist in the .tsx files.

Matching-string caveat: `PRESENCE.archived` (copy.ts:204), `LOST_ATHLETE` (copy-sportiv.ts:23) and `STATES.noAccess` (copy-shared.ts:41) are compared with `===` against server messages (PresenceView.tsx:129, LessonView.tsx:81, use-sportiv.ts:29, DocumentRow.tsx:28, upstream.ts:53, use-portal.ts:39). Changing them needs the backend message changed in the same step.

## Antrenor (coach)

| file:line | where it shows | current text | verdict | proposal |
|---|---|---|---|---|
| copy.ts:66 | Club today sheet, description under title (club/ClubTodayPopup.tsx:56) | "{day}. Atinge o grupă ca să vezi copiii sau să faci prezența ca înlocuitor." | SHORTEN | "{day}" |
| copy.ts:69 | Club today sheet, empty state (ClubTodayPopup.tsx:61) | "Azi nu are loc niciun antrenament în club." | SHORTEN | "Niciun antrenament azi." |
| copy.ts:100 | Delete/edit lesson scope sheet, sub of option 1 (lectie/[id]/ScopeSheet.tsx) | "Doar lecția din {date}." | REMOVE | none; the title and label "Doar această lecție" already say it |
| copy.ts:101 | Scope sheet, sub of option 2 | "Lecțiile din {date} până la sfârșitul seriei." | SHORTEN | "Din {date} până la sfârșitul seriei." |
| copy.ts:102 | Scope sheet when deleting, sub of option 2 | "Lecțiile din {date} până la sfârșitul seriei. Cele ținute sau plătite rămân." | SHORTEN | "Din {date} până la sfârșitul seriei. Cele ținute sau plătite rămân." |
| copy.ts:103 | Scope sheet when edit ends the series (EditLessonPopup.tsx:55) | "Lecțiile din {date} se șterg, rămâne doar aceasta, fără repetare." | SHORTEN | "Următoarele se șterg. Aceasta nu se mai repetă." |
| copy.ts:109 | New training form, summary band for a one-off (antrenament/TrainingForm.tsx:166) | "{when}, {time}, o singură dată." | REMOVE | none; date and time fields are right above it |
| copy.ts:115 | New training form, note under the monthly rule (TrainingForm.tsx:153) | 'Săptămâna din lună se ia din "Din data": {day} este {nth}.' | REMOVE | none; the summary band below already says "Lunar, în a doua marți a lunii" |
| copy.ts:120 | Calendar page, sub line in header and PageSub (calendar/CalendarView.tsx:58,60) | "Ședințele și lecțiile tale" | REMOVE | none |
| copy.ts:126 | Calendar, empty selected day (CalendarView.tsx:74) | "Nicio ședință în această zi." | SHORTEN | "Nicio ședință." |
| copy.ts:158 | Group page (other coach's group), note above info card (grupe/[id]/GroupView.tsx:139) | "Grupa altui antrenor. Poți ține antrenamentul de azi ca înlocuitor." | SHORTEN | "Grupa altui antrenor." (the button "Înlocuiesc azi" says the rest) |
| copy.ts:174 | Move athlete sheet, description (modifica/MoveSheet.tsx:46) | "Prezențele de până acum rămân în {group}." | SHORTEN | "Prezențele rămân în {group}." |
| copy.ts:180 | Remove athlete sheet, description (modifica/RemoveSheet.tsx:42) | "Prezențele de până acum rămân. Nu mai apare la ședințele grupei." | SHORTEN | "Prezențele rămân." |
| copy.ts:182 | Move athlete sheet, when no other group (MoveSheet.tsx:49) | "Nu ai altă grupă în care să-l muți." | SHORTEN | "Nu ai altă grupă." |
| copy.ts:203 | Presence screen, muted line under coach picker (prezenta/PresenceView.tsx:184) | "Vei apărea ca antrenor la această ședință." | REMOVE | none; the coach picker already lists you |
| copy.ts:204 | Presence (PresenceView.tsx:176) and lesson (LessonView.tsx:101) | "Arhivată. Nu mai poate fi modificată." | ICON | lock icon, aria-label/tooltip "Arhivată" (server-matched string, see caveat) |
| copy.ts:205 | Presence screen, muted line when session is in the future (PresenceView.tsx:174) | "Prezența se poate face din ziua antrenamentului." | SHORTEN | "Din ziua antrenamentului." |
| copy.ts:210 | Inactive athlete dialog, body (prezenta/ReactivateDialog.tsx:16) | "{name} are statusul Inactiv. Reactivezi sportivul?" | SHORTEN | "Îl reactivezi pe {name}?" |
| copy.ts:250 | New athlete form, birth date label "(opțional)" (sportiv-nou/NewAthlete.tsx:81) and other optional fields | "Data nașterii (opțional)" | REMOVE | label without suffix; mark required fields with the star instead |
| copy.ts:261 | Athlete card, toast after copying phone (sportiv/[id]/AthleteCard.tsx:36) | "Numărul a fost copiat." | SHORTEN | "Copiat." (and swap the copy icon to a check) |
| copy.ts:262 | Athlete card, toast on copy failure | "Nu am putut copia numărul." | SHORTEN | "Nu s-a putut copia." |
| copy.ts:285 | Competitions page, sub line (concursuri/CompetitionsView.tsx:40,42) | "Rezultatele sportivilor clubului" | REMOVE | none |
| copy.ts:292 | Competitions page (CompetitionsView.tsx:67) and athlete card (AthleteCard.tsx:54) | "Rezultatele nu sunt disponibile acum." | SHORTEN | "Rezultate indisponibile." |
| copy.ts:314 | Program tab, empty month (grupe/[id]/_program/ProgramTab.tsx:97) | "Nimic programat în această lună." | SHORTEN | "Nimic programat." |
| copy.ts:316 | Program tab, hint under the "Arată programul pe site" switch (PublicSwitch.tsx:12) | "Programul este public, îl vede oricine pe site." | REMOVE | none; the label already says it |
| copy.ts:322 | Program tab, line above the dates list (ProgramTab.tsx:88) | "Se arată următoarele {n} date" | REMOVE | none; heading "Următoarele date" and "Vezi toate" already say it |
| copy.ts:329 | Date sheet (change one date), description (_program/DateSheet.tsx:51) | "Schimbi doar această dată. Programul săptămânal rămâne." | REMOVE | none; the title is the date, options are explicit |
| copy.ts:331 | Date sheet, sub of option "Mută" (DateSheet.tsx:63) | "Alegi altă zi sau oră pentru această dată." | REMOVE | none; the fields appear when selected |
| copy.ts:333 | Date sheet, sub of option "Șterge" (DateSheet.tsx:71) | "Data dispare din program, fără notă." | SHORTEN | "Dispare, fără notă." |
| copy.ts:336 | Date sheet, sub of option "Se ține" (DateSheet.tsx:72) | "Data revine în program cum era." | REMOVE | none; label "Se ține" is clear |
| copy.ts:338 | Change program sheet, description (_program/ChangeSheet.tsx:41) | "{rule}. Datele de dinainte rămân cum au fost." | SHORTEN | "{rule}. Datele trecute rămân." |
| copy.ts:340 | End program sheet, description (_program/EndSheet.tsx:30) | "Ședințele și prezențele de până atunci rămân. După data aleasă nu mai apare." | SHORTEN | "Ședințele și prezențele de până atunci rămân." |
| copy.ts:341 | Program tab, line for School groups (ProgramTab.tsx:120) | "Programul Școlii îl schimbă administratorul." | ICON | lock icon next to the program heading, tooltip "Îl schimbă administratorul" |
| copy.ts:349-352 | Program toasts after cancel / move / keep / remove a date | "Ședința din {day} a fost anulată." (also "a fost mutată", "se ține", "a fost ștearsă") | SHORTEN | "Ședința din {day} anulată." / "mutată." / "se ține." / "ștearsă." |
| copy.ts:387 | Profile list, sub of "Setări cont" (profil/ProfileView.tsx:22) | "nume, e-mail, telefon, parolă" | REMOVE | none |
| copy.ts:388 | Profile list, sub of "Securitate" (ProfileView.tsx:23) | "dispozitive conectate" | REMOVE | none |
| copy.ts:396 | Account settings, note under name and e-mail card (profil/setari/SettingsView.tsx:60) | "Numele și e-mailul le schimbă administratorul. După schimbarea e-mailului, intri cu adresa nouă." | SHORTEN | "Le schimbă administratorul." (or lock icon on both rows with that tooltip) |

## Sportiv (athlete and parent)

| file:line | where it shows | current text | verdict | proposal |
|---|---|---|---|---|
| copy-sportiv.ts:20 | Concursuri (concursuri/page.tsx:86), competition detail (concursuri/[resultId]/page.tsx:87), Acasă card (_parts/LastCompetitionCard.tsx:16) | "Rezultatele nu sunt disponibile acum." | SHORTEN | "Rezultate indisponibile." |
| copy-sportiv.ts:30 | Athlete picker, sub line (page.tsx:28,30) | "Alege sportivul." | REMOVE | none; the screen is a list of athletes |
| copy-sportiv.ts:42 | Notices panel, inline status line and toast, same text twice (_ui/NoticesPanel.tsx:27,32) | "Nu s-a putut închide. Încearcă din nou." | SHORTEN | keep only the toast, "Nu s-a putut închide." |
| copy-sportiv.ts:54 | Acasă last-competition card (LastCompetitionCard.tsx:36), Concursuri (concursuri/page.tsx:87), detail (concursuri/[resultId]/page.tsx:90) | "Rezultatele pot fi mai vechi. Actualizate {date}." | SHORTEN | "Actualizat {date}." |
| copy-sportiv.ts:55 | Promotion dialog, body (_parts/PromotionDialog.tsx) | "Felicitări, {firstName}! Ai trecut la nivelul următor." | SHORTEN | "Felicitări, {firstName}!" (title is "Nivel nou") |
| copy-sportiv.ts:81 | Calendar page, sub line (calendar/page.tsx:73) | "{name}, doar ședințele proprii" | SHORTEN | "{name}" |
| copy-sportiv.ts:85 | Calendar page, link under the month (calendar/page.tsx:83) | "Adaugă în calendarul telefonului" | SHORTEN | "Adaugă în telefon" |
| copy-sportiv.ts:86 | Calendar, empty selected day | "Nicio ședință în această zi." | SHORTEN | "Nicio ședință." |
| copy-sportiv.ts:107 | Parcurs, "Următorul nivel" card, muted line (parcurs/page.tsx:51) | "Antrenorul decide când treci mai departe." | SHORTEN | "Decide antrenorul." |
| copy-sportiv.ts:135 | Competition detail, link to official page | "Clasamentul complet (pagina oficială) ›" | SHORTEN | "Clasament oficial ›" |
| copy-sportiv.ts:142 | Plăți, owed card, line under the amount (plati/_parts/LeftCard.tsx:41) | "Plata se face la club." | SHORTEN | "Plata la club." |
| copy-sportiv.ts:144 | Plăți, ticket sheet, note under validity (plati/_parts/TicketSheet.tsx:27) | "Data se poate prelungi dacă școala are un weekend liber." | ICON | info icon next to "Valabil până la", tooltip "Se poate prelungi dacă școala are weekend liber." |
| copy-sportiv.ts:155 | Setări, "Contul meu", extra text next to e-mail (setari/_parts/AccountRows.tsx:55) | "îl schimbă clubul" | ICON | lock icon, tooltip "Îl schimbă clubul" |
| copy-sportiv.ts:157 | Setări, "Date sportiv" note (setari/sportiv/[athleteId]/page.tsx) | "Le schimbă clubul." | ICON | lock icon on the card, tooltip "Le schimbă clubul" |

## Shared portal parts

| file:line | where it shows | current text | verdict | proposal |
|---|---|---|---|---|
| copy.ts:30 (NOT_FOUND.text, both portals' not-found.tsx:14 and :12) | 404 page, paragraph under the title | "Adresa nu duce nicăieri. Poate a fost mutată sau scrisă greșit." | REMOVE | none; title "Pagina nu există" plus the back button is enough |
| copy-shared.ts:25 | Invite page when the link is expired (invite/page.tsx:15,16) and accept route | "Invitația a expirat. Cere administratorului una nouă." | SHORTEN | "Invitația a expirat. Cere una nouă." |
| copy-shared.ts:63 | Toast after copying a phone number (CopyButton in app/_portal/ui/CopyButton.tsx, used in kit and cards) | "Numărul a fost copiat." | SHORTEN | "Copiat." |
| copy-shared.ts:64 | Same, failure toast | "Nu am putut copia numărul." | SHORTEN | "Nu s-a putut copia." |

## Counts

- REMOVE: 16
- ICON: 5
- SHORTEN: 34
- Total rows listed: 55 (rows spanning several keys, such as copy.ts:349-352, count once)
- KEEP rows skipped: about 38 (empty states, server-matched errors, short toasts, recurrence summaries for series and monthly, auth state lines, labels that are already minimal)
