# Parcurs: felt badges, awarded badges, friendship pins (2026-11-16)

Approved by the user in conversation 2026-11-16. Mockup: https://claude.ai/artifact/BaA2vTrJfDm4qAN33zHkvr (art, layout, messages). Art: the user's felt pin sheets, sliced to one transparent PNG per pin (scratchpad `badges/pins/*.png`, 69 files; names below).

Repos: edusport_backend (rules, storage, routes, admin), edusport_frontend (athlete portal Parcurs, coach portal). Copy: Romanian, diacritics, no em/en dash, no middle dot, no emoji, straight quotes, no helper text anywhere.

## Why

The current Parcurs badges use metal tiers (bronz, argint, aur, platină, gheață). The user wants no metal tiers: each milestone is its own felt pin, plus badges coaches give, plus pins athletes give each other.

## 1. Counted badges (computed on read, as today)

Replace tiers with one pin per milestone. Earned pins in colour with the date earned; the rest greyed (`grayscale` + low opacity). A badge earned several times shows the count as a plain number under the pin (never "x N", never "de N ori").

| Family | Pins (file) | Rule |
|---|---|---|
| Antrenamente | prima-lectie, antrenamente-25/50/100/250 | presences count (existing rule) |
| Concursuri | concursuri-1/2/5/10/25 | competitions count (existing rule) |
| Membru | membru-1 ... membru-15 | full years since the athlete's first membership start (replaces "Sezon complet") |
| Locul 1 | locul-1 (count) | results with placement 1 |
| Podium | podium (count) | results with placement 1-3 |
| Prezență 100% | prezenta (count) | calendar months with at least 4 saved sessions of the main group and no absence |
| Prima prietenie | manusi | first friendship pin given (decided by Claude) |

Results come from the existing competition source (skate-results when the profile has a slug, else hand-entered; never merged).

## 2. Awarded badges (stored)

Given by a coach (coach portal, own groups' athletes) or an admin (admin Sportivi record). Both can remove one given by mistake.

| Badge | Pins | Notes |
|---|---|---|
| Steaua antrenorului | steaua (count) | can be given many times |
| Test promovat | test (count) | |
| Sărituri | saritura-{1,2,3}{s,t,lo,f,lz,a} | per jump the highest level counts; giving 2S implies 1S is shown earned |

Stored record: athlete, kind (steaua | test | jump), jump code + level for jumps, given by (team member or admin), date. Shown with its date; the giver's name is visible in admin and coach portal only.

## 3. Friendship pins

- Grants (user, 2026-11-17, replaces the per-competition 3 and season-end 5): every active athlete receives 2 pins to give on the 1st of each month that falls inside a season (between the season's start and end month).
- A grant is valid until the last day of its month; unused pins are lost then (no saving up).
- Recipient: any active athlete of the club, except themselves.
- The giver picks one of 15 designs; each design has one fixed message:
  1 Bate palma! / 2 Ai strălucit. / 3 Te susțin! / 4 Un gând bun pentru tine. / 5 Mă bucur că ești în echipă. / 6 Crești frumos. / 7 Mi-ai făcut ziua mai bună. / 8 Cred în tine! / 9 Patinezi frumos. / 10 Prieteni pe gheață. / 11 Echipă bună! / 12 Te ridici de fiecare dată. / 13 Ai fost o vedetă. / 14 Ușor ca un fluture. / 15 Hai la o ciocolată caldă!
- The receiving account (parent or athlete, whoever holds access) sees the pin, the message, the giver's name and the date.
- Giving uses the oldest unexpired grant first. The button shows the remaining count: "Oferă o insignă (2)"; hidden when 0.
- Abuse: one pin per giver per recipient per grant (decided by Claude); admin can delete a pin.

## 4. Screens

- Athlete portal Parcurs: sections Antrenamente, Concursuri, Membru, Insigne, Sărituri (3 rows: simplu, dublu, triplu), Prietenie (received pins + give button). Tap a pin: larger view, name, count, date; friendship pins show the message and the giver.
- Coach portal: athlete page shows the athlete's full Parcurs (all badges, same look as the athlete portal, incl. friendship pins received) and gets "Oferă o insignă" for Steaua / Test / jump (pick jump and level).
- Admin Sportivi record: a "Parcurs" tab with the same badges, award and remove actions, and the friendship pins the athlete received and gave.

## Approaches

1. Counted badges on read (current pattern), awards and friendship in new content types (picked: keeps the existing read path, stores only what cannot be derived).
2. Store every badge when earned (rejected: backfill and drift with presence edits).
3. Friendship as portal notices (rejected: notices end and are purged; pins must persist).

## Left to the builder

- Content type names and fields; store pattern with fake parity; lock order per CLAUDE.md.
- Where grants are created (on read when a new competition result or season end is seen, idempotent per competition/season).
- Serving the PNGs: frontend `public/` (portals) and admin static assets.
- Removing the old tier copy (`tierWord`, tier aria texts) and the metal art.

## Builder check answers (decided by Claude unless marked user)

- Giver: always an athlete. An account holding several athletes gives as the athlete currently selected in the portal (the existing athlete picker); each athlete has its own grants. The recipient sees the giving athlete's name.
- Grants (superseded 2026-11-17 by the monthly rule in section 3): created on read for the current month only (once per athlete per month), when today is inside a season and the athlete is active (status nou or activ, not anonymised). No backfill of past months.
- Delete athlete: their awards, grants and pins (given and received) are deleted. Anonymise: pins stay, the giver shows as "Fost sportiv". Merge: awards, grants and pins move to the kept athlete; duplicates (same giver, recipient, grant) are dropped.
- Prezență 100%: main group = the athlete's main membership in that month; only sessions held (cancelled and moved-away dates excluded); a month counts only after it ends; months where the athlete joined after the 1st do not count; excused absences (if recorded) do not break it.
- Membru: years since the first membership start, gaps ignored; capped at 15.
- Locul 1 / Podium: counted from final results (overall placement as the source gives it); Locul 1 also counts as Podium; the date shown is the latest.
- Jumps: an implied lower level shows the date of the higher award; removing 2S leaves 1S only if 1S was given on its own; remove deletes only the explicit record.
- Admin deleting a friendship pin returns it to the giver's grant if the grant's month has not ended; the one-per-recipient-per-grant rule then allows a new pin to that recipient.
- Prima prietenie: on the first pin given; date of that pin.
- Coach scope: athletes with a membership in one of the coach's groups in the current season. Admin area: 'club' (same as Sportivi).
- Same design to the same recipient from different grants: allowed.
