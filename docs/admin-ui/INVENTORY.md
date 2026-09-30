# Admin UI inventory (2026-09-29, read-only audit)

## Style systems in use today
1. `.eduf` (src/admin/dashboard/edusportUi.ts EDU_CSS): 4px radius, accent #2138b8, danger #be3330. Sportivi, SportivEdit, Competitii, CompetitieEdit, Anunturi, AnuntEdit, HomepageEdit, Navigation, Sponsori, MembriEchipa, ProgramEdit, VoluntariatEdit.
2. `.insp` (SubmissionTable.tsx CSS ~384-570): same palette, own tokens (--r:5px), own .tag/.btn/.pop/.sheet. Înscrieri + Voluntari.
3. Page-local CSS: DashboardPage (.esdp ~79), FormularePage (.esfm ~27), FormEditorPage (~98), FormResultsPage (.fres ~139), MesajePage (.mesg ~142). .fres and .mesg are near-identical.
4. `.pce` calendar editor (src/plugins/component-preview/admin/src/ProgramOverviewEditor.tsx ~979): raw hex inline styles, 20px pills. NOTE: class `.pce` is ALSO used by dashboard pages to opt out of the global SaveBar tagger (app.tsx ~487): two meanings for one class.
5. Strapi design-system tier (component-preview: EditorField, EditorCard, Section, DeleteIconButton, PluginModalShell): theme-aware.
Theme mirroring (read STRAPI_THEME from localStorage + poll + matchMedia) duplicated in SaveBar.tsx ~63-90, MobileNav.tsx ~65-105, BlocksToolbarExtra.tsx ~80-99.
Off-palette raw colours: ProgramOverviewEditor ~945 (#9aa4d6 disabled, #2138b8), ~950 (#be3330/#e2c4c4, radius 8); AddListButton.tsx ~19-22 and InlineStringList.tsx ~43-44,143-146 use Strapi purple #4945ff / red #d02b20.

## Pills / badges (10 versions)
.pill/.pill.auto (edusportUi ~201), .pubseg segmented (edusportUi ~162, SportivEdit ~586), LEVEL_COLOR text (edusportUi ~36), .tag status (SubmissionTable ~460, statusCss()), .fchip filter chip (~445), .fval (~439), .sb round status (FormResults ~171), .hc (FormResults ~174), .rc reason chips 8 colours (Mesaje ~186), .esfm-chip (Formulare ~56), .a-pill/.stpill/.chip (Dashboard ~88,120,132), .tgl switch (Dashboard ~123, the only real switch), .spill/.kchip/.pce-pill (ProgramOverviewEditor CSS ~1063-1082; .pce-pill is a 28px circle).

## Save (3 flows, no leave guard anywhere in custom pages)
- Global SaveBar (src/admin/SaveBar.tsx): native content-manager forms; mirrors Strapi's hidden buttons; Cmd/Ctrl+S; two-step discard.
- Own button, no dirty flag: AnuntEdit ~304/535, CompetitieEdit ~267/401, HomepageEdit ~539/1114, SportivEdit ~542/951, MembriEchipa ~576, Sponsori ~425. Messages via .msg.ok/.err.
- Own button with dirty flag: Navigation ~321/530, VoluntariatEdit ~356/688, ProgramEdit ~42/143, ProgramOverviewEditor ~944.
- Autosave: Mesaje, SubmissionTable (Înscrieri/Voluntari), FormResults/ParteneriRezultate.
- Delete confirm: shared ConfirmDialog (src/admin/ConfirmDialog.tsx), 15 call sites. Keep.

## Buttons
.eduf .btn/.pri/.sm/.danger (edusportUi ~68-75); .insp .btn (~396); .esfm-btn (~33); .fres/.mesg .btn (+.btn.ok green in Mesaje); AddListButton/InlineStringList (Strapi purple, JS hover); DeleteIconButton (theme-aware); ProgramOverviewEditor inline (radius 8); BlocksToolbarExtra ToolbarButton; SaveBar inline variants (radius 6).

## Fields
.eduf input/select/textarea (edusportUi ~63); .fld > label; .toggle = checkbox; .hint; errors only as top banners; FormEditor .reqdot; SafeDatePicker/TimePicker/SpinnerInput (component-preview); .relbox relation picker (edusportUi ~137-150); SearchableSelect (component-preview).

## Tables / lists
.eduf .tbl (no pagination; Sportivi ~72 and Competitii ~77 load 200/300 rows); SubmissionTable full table (pager, sort, quick/advanced filters, bulk select, column reorder with .grip); .fres-list/.mesg-list inbox two-pane with duplicated pager; 4 empty-state copies.

## Page chrome
.eduf .hd/.win/.cols/.rail/.body/.sec/.sh/.sb/.pa (edusportUi); Dashboard .a-hero/.a-kpis/.a-grid; Formulare .esfm-head; .fres-head/.mesg-head. Shell: EdusportShell.tsx (own createRoot, navy sidebar). MobileNav reads Strapi sidebar links from the DOM instead of menu.tsx EDUSPORT_LINKS.

## Dialogs / popovers
ConfirmDialog (Esc + backdrop); dashboard MediaModal (src/admin/dashboard/MediaPicker.tsx, no Esc); plugin MediaPicker + PluginModalShell (Strapi Modal); .mws dialog (SubmissionTable ~560); SheetsDialog own chrome; popovers .qfpop/.advpop/.pop/.menu (SubmissionTable), .relmenu (edusportUi).

## Messages / loading
.msg.ok/.err, .notice (edusportUi ~103, ~190); .insp-msg ok/warn/err; .fres-msg/.mesg-msg; loading mostly plain text, SaveBar has a spinner (~554).

## Media
.photo/.pv, .gal grid (edusportUi); dashboard MediaModal; plugin MediaPicker; imagePickerStore + native MediaLibraryDialog (BlocksToolbarExtra ~336).

## Other
ProgramOverviewEditor mini calendar grid; tabs duplicated (.fres-tabs, .mesg-tabs, .scoala-tabs/.pce-mode).

# Pass 2 (2026-09-30): field editors and page-level blocks (src/plugins/component-preview/admin/src)
- Banner/info editor copied 11 times (~1150 lines): PageBanner, CourseRegsBanner, RealizariPageBanner, HistoricPageInfo, TeamPageInfo, ProgramPageInfo, SiteSettingsContact, CursuriPageBanner, CursuriPageAbout, PartnersContent, VolunteerContent. Same skeleton: EMPTY -> useField -> useState -> useEffect resync -> update(key) -> EditorCard + fields.
- Repeatable object lists, 6 implementations: RulesTable (HTML5 drag :79-108, chevron expand :171), PricingTiersEditor (button expand :174-228), ScheduleGroupsEditor (drag :130-142, own .esg CSS raw hex, native time inputs :198-213), VolunteerHelpWaysEditor, ParticipantsEditor, CalendarEventsEditor special rows (Accordion). Deletes are one-click with no confirm (RulesTable :178, PricingTiers :137, VolunteerHelpWays :94, Participants :168).
- Galleries x3: HomepageEdit (3 fixed slots :135), SportivEdit (open list :845), VoluntariatEdit (.gal 4 cols :134).
- Date range x2: SiteSettingsRegistration :144-200 (not clamped), CalendarEvents SpecialEventRow :739-762 (clamped).
- Time inputs x3: components/TimePicker (canonical), native in ScheduleGroups, TimePicker reused in ProgramOverview.
- Number: components/SpinnerInput vs digit-filtered TextInput in ParticipantsEditor :134-165.
- Tags/multi: DS MultiSelect (QuickCreateSportspersonModal :328), TagsInput (raw, var(--strapi-*)), InlineStringList.
- Media: components/MediaPicker, dashboard MediaModal, VideoEmbedEditor's own VideoPicker :52-172, imagePickerStore + native MediaLibraryDialog.
- Segmented: DS Radio.Group in VideoEmbedEditor :274-295 vs .pubseg.
- Sections: components/Section duplicates src/admin/ui/Section; local SectionTitle copies in CursuriPageAbout :34, SiteSettingsContact :32, CursuriPageBanner :76, CursuriPagePromoCard :104.
- Plugin mini design system: EditorCard, EditorField, AddListButton (raw #4945ff), InlineStringList (raw #d02b20), DeleteIconButton, LinkOutCard, HelpTip, LinkPicker, MarkdownEditor, SafeDatePicker, SpinnerInput, TimePicker, StringListEditor; PluginModalShell + FormSection/FormRow duplicate Modal/Section.
- Regressions: QuickCreateSportspersonModal :295 uses raw DS DatePicker (timezone bug SafeDatePicker fixes); InlineStringList :133 copies AddListButton.
