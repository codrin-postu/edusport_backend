# Breaks per group, payment purpose list, student notices, portal tracking (design)

Status: approved by the user 2026-11-14 in the admin canvas (https://claude.ai/artifact/Cx3uxTqtnuPWDAuB8vR6ws, rows "Pentru", "Pauze", "Anunț") and the portal canvas (https://claude.ai/artifact/KxCdLAg91hYSVyqhcChVPB, rows "Mesaje separat, deasupra numelui", "Ședințe anulate și mutate în listele sportivului"). Quotes `[U "..."]` are the user's words. Everything not named here keeps the current specs (P4 groups and schedules, P5 attendance and payments, sportiv app spec, admin redesign 2026-11-12).

Copy: Romanian, terse, no em or en dash, no middle dot, straight quotes, no emoji. Visual: square corners (date block and the phone floating menu excepted), no pills or circles, no dashed lines, no red text except a date block's top word, no small uppercase eyebrows, no hint lines under inputs (labels, star for required).

## 1. Payment purpose ("Pentru") in the payment window

Approved board "Pentru, propunere" [U "ok"].
- "Pentru" becomes the first field after "Sportiv"; Sumă, Data, Metodă follow.
- The list is grouped: "De plată" (items with something owed, each line shows the amount on the right: "rămas 380 RON", or the full price for an unpaid cotizație "270 RON"), "Achitate" (lines with "achitat", still selectable, for corrections), "Altele" ("Altceva", "orice sumă"). Options and their meaning are unchanged (abonament, cotizație per season, Club month, individual lesson, altceva; P5 4.15).
- Choosing a line fills Sumă with what is still owed (unchanged rule); the closed field shows the choice and its amount on the right.
- Grouping and amounts come from the existing option builder (rules.ts options already carry the default amount = owed); add `owed` and `paid` per option to the options answer if missing.

## 2. Breaks (Pauze) per group

Approved boards "Pauză C" (sections) and "Calendar: pauza ca o singură bandă".
- A break applies to chosen groups. Data: the break keeps its name and dates and gains the list of groups it does NOT apply to (`exceptGroupIds`, empty = all groups), so a group created later is affected by default [decided by Claude: the user's model is "all ticked, untick what stays"].
- Dialog "Pauză nouă" / edit: Nume, De la, Până la, then the impact box: title "Se anulează <n> ședințe la <k> din <m> grupe"; two sections "Școala de patinaj" and "Club", each with a tick box (ticks or unticks its groups; shows a dash when partly ticked) and its session count; under them each group with a tick box and "<n> ședințe", "nicio ședință" or, when unticked, "rămâne"; last line "Lecțiile individuale și competițiile rămân." Counts are the real held occurrences in the range (this fixes today's bug where the dialog says "Nicio ședință a grupelor în aceste zile." although the calendar has sessions).
- Pauze list (section on "Calendar și serii"): columns Nume, De la, Până la, Se anulează ("10 ședințe, toate grupele" or "8 ședințe, 5 din 6 grupe"), Editează.
- Effect: a break cancels the occurrences of its groups only (today `breakApplies` cancels every group event); everywhere that expands the calendar (admin calendar, coach portal, sportiv portal, website, presence) uses the per-group rule. Unchanged: individual lessons and competitions stay; a "Mută" on a break date still holds; breaks are not copied to a new season.
- Calendar month view (admin, coach, sportiv where a month grid exists): every event that lasts several days (breaks, holidays, multi-day competitions and other multi-day events) is drawn as one band across its days in each week row, name at the start of each row piece; under the band the cancelled sessions stay visible, faded and struck through; sessions of unticked groups stay normal [U "yes" to "a single band for all multi-day events"].

## 3. Student notices ("Mesaje")

Approved: no popup [U "a popup is overkill"], a message list; placement [U "move it above the username on sidebar, also on mobile"]; [U "for now its fine to be just for students"].
- Student portal only. Desktop: "Mesaje" item with a bell icon and a square counter at the bottom of the sidebar, directly above the account row, separated by a thin solid line; it opens a panel on the right, full height, about 420 px, list of message cards (standard card shadow, the panel's shadow must not stack over the cards). Phone: no bell in the header; the account button shows the counter ("Ana 2 ▾"); in the account sheet a "Mesaje" row with bell and counter is the first row, separated by a line; it opens the list as a sheet.
- A message card: muted date ("13 noi"), title, body, "×" (aria-label "Închide") that dismisses it for the account (not per device). Counter = undismissed, unexpired messages.
- Automatic messages: when sessions of an athlete the account holds are cancelled or moved within the next 14 days, one message "<n> ședințe anulate" (or "<n> ședințe anulate sau mutate"), body = compact rows (date block, "18:00 Intermediari Bronze, Ana", reason line: the break name, the cancel note, or "Mutată: Vi 20 noi, 17:00"), sorted by date; it expires after its last date. Cancelled = break, calendar cancel of an occurrence, deleted planned individual lesson. Moved = an occurrence moved ("Mută") or a lesson time change. Child first name only when the account holds more than one athlete.
- Hand-written messages: from the admin Anunțuri page (section 4) when "Portal sportiv" is ticked, to the chosen groups (an account sees it when one of its athletes is in one of those groups, or all when "Toate grupele").

## 4. Admin Anunțuri for the student portal

Approved board "Anunț" with the changes said in chat.
- Editor: new section "Unde apare" with tick boxes "Site" and "Portal sportiv" (no coach portal for now). New section "Pentru cine", shown when "Portal sportiv" is ticked: SegmentedControl "Toate grupele" | "Grupe alese", then the same section-and-group tick-box tree as Pauze. Dates come from the existing "Programare" section (no extra "Afișat" block). "Format", button text and link apply to "Site" only and are hidden when only "Portal sportiv" is ticked. Remove the grey hint lines under inputs on this page.
- List: two short columns "Unde" ("Site", "Portal sportiv", "Site, Portal sportiv") and "Pentru" ("Toți", "<n> grupe").
- An announcement with only "Site" behaves exactly as today.

## 5. Sessions in the student portal lists

Approved board row "Ședințe anulate și mutate".
- Acasă "Următoarele ședințe" keeps cancelled sessions (today they are left out): faded date block (`dim`), time struck through, right band "Anulată" (the cancelled band, made slightly darker than today so it reads as a state), second muted line with the reason. Moved sessions show normally with a muted line "Mutată de pe <zi> <d> <lună>, <ora>".
- Calendar day list: the cancelled row also shows the reason line (today only on opening).
- Data: the backend records where a moved occurrence or lesson came from (`movedFrom`: date and time) so the line can be shown; calendar and home items carry `reason` (break name or cancel note) and `movedFrom`.

## 6. Tracking in both portals

[U "we need to add umami and glitchtip tracking to student/coach apps too"; confirmed "yes"]. Overrides the phase 7 rule "no Umami" on the portal hosts.
- Umami on antrenor. and sportiv.: page views with the path normalised to the route pattern (athlete ids, result ids and any other id replaced, e.g. `/[athlete]/istoric`); no events carry names, e-mails or ids. Same Umami instance as the website, one website id per portal host (env).
- GlitchTip (Sentry SDK) in both portals and their BFF routes: errors only, no session replay, `sendDefaultPii: false`, a beforeSend that strips e-mails, names, ids, cookies and query strings; release and environment tags.

## 7. Not in this package

Coach portal messages; deleting old Umami data; the frontend main-site changes.

## 8. Decided by Claude (low impact)

- S1 `exceptGroupIds` (unticked groups) rather than included ids, so new groups are covered.
- S2 The 14-day window and per-account dismissal for automatic messages (as proposed in chat, not objected to).
- S3 "Achitate" options stay selectable (corrections).
- S4 Section header counts are the sum of the ticked groups' sessions.
