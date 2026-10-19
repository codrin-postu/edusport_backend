# 01. Glossary

One term per concept, used in all diagrams and code. UI copy stays Romanian.

| Term | Romanian (UI) | Meaning |
|---|---|---|
| Athlete | Sportiv | A person who trains at the club. Every athlete has one record (today's `sportsperson`, renamed). Private: birth date, contacts, groups, attendance, money. |
| Public profile | Profil public | Optional part of an athlete, stored in its own table: the page on the website. Only this part is public. |
| Season | Sezon | The training year, e.g. 2026-2027, with a start and end month. |
| Section | Secțiune | Skating School or Club. Every group belongs to one. |
| Group | Grupă | A training group (e.g. Primii Pași, Performanță Juniori), in one section, with coaches and a price list. |
| Membership | Apartenență la grupă | An athlete on a group's list for a season. |
| Main group | Grupa principală | The one membership marked main. Exactly one per athlete per season. |
| Schedule | Program | When a group trains: recurring times, plus single-date changes. |
| Session | Ședință | One occurrence of a group training on a date and time. |
| Individual lesson | Lecție individuală | One coach with one athlete, separate from group sessions. |
| Attendance | Prezență | An athlete present at a session (or lesson). An athlete not on the group's list can be added to a single session. |
| Coach | Antrenor | A team member with a portal account. |
| Price list | Listă de prețuri | Named set of price items (e.g. Standard, Avansați Gold). Groups on the same list share subscriptions. |
| Price item | Element de preț | One thing that can be bought or billed: 8-session subscription, single session, individual lesson. Member and non-member price. |
| Membership fee | Cotizație membru A.C.S. | Yearly association fee, per season. |
| Subscription | Abonament | Prepaid sessions (6 or 8) for the Skating School, valid from start date plus 4 weeks (estimate); an admin can manually extend all active subscriptions by X weeks. |
| Subscription slot | Căsuță | One session in a subscription. Each attendance at a Skating School session uses one. |
| Amount due | De achitat | What a club-group athlete owes for sessions done (billed after training). |
| Payment | Plată | Money received: cash, POS at the rink, or bank transfer. |
| Registration | Înscriere | The website form submission, with a registration number (e.g. 2026-0142). |
| Confirmation | Confirmare | Admin turns a registration into an athlete (new or matched existing). |
| Document | Document | A generated PDF (Acord, Cerere de adeziune) or an uploaded file, for an athlete or the club. |
| Document type | Tip de document | Defines how a document appears (generated or uploaded), when, and if it has a blank form. |
| Parent | Părinte | A portal account with access to one or more athletes. |
| History | Istoric | Log of changes and corrections (who, what, when). |
