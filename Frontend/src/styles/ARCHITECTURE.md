# Where does a style go?

One question, five possible answers. Work down the list and stop at the first
one that fits.

## 0. Is it type — a size, a weight, a case?

Then the question is not "what size do I want" but **"what is this thing?"**.
The same thing must read the same in all seven portals, so each ROLE has one
answer and you take the answer rather than choosing:

| Role | Where it appears | Size | Weight | Case |
|---|---|---|---|---|
| Page title | the `<h1>` in `DashboardHeader` | `--text-title` (18) | 700 | as written |
| Dialog title | `.tt-modal-title`, `.modal-title` | `--text-title` (18) | 700 | as written |
| Panel title | `.card-title`, `.dt-title` (`DataTable`, `ListSection`) | `--text-body` (15) | 700 | as written |
| Stat number | `.portal-stat-value` | `--text-stat` (32) | 800 | as written |
| Body | prose, form values, table cells | `--text-body` (15) | 400 | as written |
| **Control label** | `.btn`, `.tab-btn`, `.filter-tab`, `.sidebar-nav-item` | `--text-sm` (13) | **600** | as written |
| Secondary | table cells, meta lines | `--text-sm` (13) | 400–500 | as written |
| Column heading | every `th`, hand-rolled or `DataTable` | `--text-caption` (12) | 700 | UPPERCASE, `0.04em` |
| Eyebrow label | `.class-picker-label`, `.adm-modal-label`, stat captions | `--text-caption` (12) | 700 | UPPERCASE, `0.04em` |
| Badge | `.badge`, `.tab-count` | `--text-caption` (12) | 600–700 | as written |

## Icons beside words

An icon takes the scale of the text it stands next to, and the CONTAINER sets
it — `.btn`, `.card-title`, `.dt-title`, `.filter-tab`, `.tab-btn` and `.badge`
all size their own icons, so no caller writes `icon-sm` on a button. Reach for
`.icon-xs/-sm/-md/-lg` only when one icon in a row must differ from its
neighbours.

The size follows the ROLE of the text, not the icon:

| Beside | Icon | Examples |
|---|---|---|
| a panel title | `--icon-md` (20) | `.card-title`, `.dt-title`, `.tt-modal-header` |
| a control label | `--icon-sm` (18) | `.btn`, `.filter-tab`, `.tab-btn`, `.badge` |
| a nav item | `--icon-md` (20) | `.sidebar-nav-item` |

Two things this fixed:

- `.icon-sm` and `.icon-md` were defined in **teacher.css**, one portal's
  stylesheet imported by 13 files, while 56 files across every portal used
  them. Everywhere else the class was inert and the icon fell back to the
  font's own 24px beside 13px text. `.icon-md` was also defined as
  `--icon-sm`, so it was impossible to ask for 20px.
- `.card-title` was a plain block, so its icon sat on the text BASELINE at
  24px next to a 15px heading. It is a flex row now.
- `.tab-btn` sized its icon at a hardcoded `1.1rem` — the control-label role
  at a value half a pixel off every other control, and the last icon rule in
  `components.css` not spending a token.

Alignment inside a toolbar has one more trap. `.filter-tabs-bar` carries a
bottom margin because it was built to stand ALONE above the list it filters.
Dropped into a `.toolbar-card`, that margin makes its box taller than the chips
in it, and a card that centres its children then sits the chips above the
button beside them. A control inside a toolbar does not set page spacing:
`tables.css` zeroes it there.

The sidebar is the reference for the ramp, because it was right first: brand
`--text-title`/800, nav item `--text-sm`/600, group heading `--text-caption`
uppercase. Main content now uses the same steps, so the rail and the page beside
it stop reading as two applications bolted together.

Five things this fixed, all of them the same mistake:

- `.card-title` was `--text-title`/600 — the same size as the page title — while
  `.dt-title` right below it was `--text-body`/700. Every card shouted as loudly
  as the name of the page.
- The bare `th` was `--text-body`/500 in sentence case while `.dt-table th` was
  `--text-caption`/700 uppercase, so a hand-written table and a `DataTable` on
  the same screen looked unrelated.
- A narrow-screen `th` override restated the caption treatment with a different
  letter-spacing, so the headings changed shape at 767px.
- `.btn` and `.filter-tab` were weight 500 while `.tab-btn` and
  `.sidebar-nav-item` were 600 — four controls doing one job at two weights.
- The two dialog systems set their titles three points apart, so a dialog's
  heading size depended on which one the page happened to use.

If a role is missing from this table, add the row before you add the rule.

## 1. Is it a colour, size, radius or shadow?

It is a **token**, and it belongs in `src/index.css`.

- Something every portal shares (ink, the semantic colour families, shadows,
  radii, spacing) goes in the bare `:root[data-portal]` block.
- Something that differs per portal goes in that portal's
  `:root[data-portal="<portal>"]` block.

Never write a colour literal anywhere else. If you are typing `#` outside
`index.css`, you are almost certainly creating the next `--admin` /
`--discipline` / `--primary` split, where the same component ends up with three
different sources for one colour.

## 2. Is it chrome — sidebar, header, card, button, badge, input, table?

It belongs in `src/styles/portal-theme.css`, scoped `[data-portal]`, and it must
spend tokens rather than name colours. One rule serves all seven portals.

## 3. Is it a reusable piece of UI?

Then it is a **component**, and it already exists. Check
`src/components/ui/` and `src/components/layout/` before writing anything:

| Need | Use |
|---|---|
| A statistic tile | `StatCard` |
| The greeting bar at the top of a dashboard | `WelcomeBanner` |
| A table with sorting / empty state | `DataTable` |
| Any OTHER list — a card grid, a list of rows | `ListSection` |
| "Nothing here yet" | `EmptyState` |
| A row of filter chips or tabs | `FilterBar` / `TabGroup` |
| A class / stream selector | `ClassPicker` |
| A dialog | `Modal` |
| A dropdown | `Select` |
| Paging controls | `PaginationBar` |

And the pieces below a component — a class of markup rather than a component —
live in `components.css` under a neutral name:

| Need | Use |
|---|---|
| A list of records that is not a table | `.row-list` > `.row-item` |
| Inside a row: name and caption / figures / buttons | `.row-main`, `.row-figures`, `.row-actions` |
| A whole row that is clickable | `.row-item-button` (a real `<button>`) |
| The chip at the left of a row | `.class-chip`, `.row-avatar`, `.row-icon` |
| Headline figures above the detail | `.figure-strip` > div, `.figure-label` |
| A `<dl>` of label/value pairs | `.detail-grid` |
| Fields side by side in a dialog | `.form-grid`, `.form-col-full` |
| An amount that is owed or missing | `.amount-owed` |
| The colour of a status | `.pill-ok / -warn / -info / -danger / -muted` |

All of these were `fin-*` in `finance.css` first. Library then reached across
for eleven of them, which is the signal that they were never finance patterns
— and `.class-chip` was worse: defined in `discipline.css` against
`--discipline`, so a class chip in Finance, DOS or Library rendered in the
Discipline portal's colour in five portals at once.

**A status never carries its own colour.** There were five families saying the
same five things — `fin-status-*`, `fin-expense-*`, `fin-payroll-*`,
`fin-budget-*`, `lib-count-*` — twenty rules doing five jobs, and every new
domain added five more, which is why "pending" was amber on one page and grey
on the next for no reason anybody chose. `utils/tone.js` maps the WORD to a
tone once; `pill(status)` and `badge(status)` return the classes. A domain with
a word the table lacks adds the word, not a family of colours.

Its CSS lives once, in `components.css`, under the component's own class names
(`portal-stat-*`, `welcome-banner-*`, and so on). **Change it there and every
portal changes.** That is the whole point.

If a component is close but not quite right, add a prop or a modifier class to
the shared component. Do not copy its markup into your page and rename the
classes — that is how one stat tile became nine.

`ListSection` and `DataTable` deliberately draw the SAME frame (`dt-container`
→ `dt-header` → `dt-body`), because a card grid rendered straight onto the page
background and a table rendered inside a border read as two different pages
even when they are two halves of one tab. `.act-list-card` in `discipline.css`
was a second copy of that frame at a different padding, radius and shadow —
and three Student pages used those classes without importing the stylesheet
that defined them, so they were drawing no frame at all.

## 4. Is it genuinely unique to this one page?

Only then does it go in the portal's own stylesheet (`dos.css`, `admin.css`, …)
under a portal-prefixed class (`dos-`, `adm-`, `disc-`, …).

Prefix it properly. Vite bundles every stylesheet into one file, so nothing is
route-scoped: a bare `.ann-chip` in `pages.css` restyles anything with that
class in any other portal.

And never reach for another portal's class. `DosSettings.jsx` and
`MatronSchedule.jsx` both used `disc-stat-card`, which meant editing
`discipline.css` silently changed three portals.

## The guard

`src/styles/architecture.test.js` enforces the parts of this that can be
checked automatically:

- no page hand-rolls a component that already exists
- no page uses another portal's prefix
- **no page passes a shared component a prop it does not accept**
- no colour literals outside `index.css`

The third one is not a ratchet — it is zero and stays zero, because a prop a
component ignores has never been anything but a bug. React drops an unknown
prop silently: no warning, no error, nothing in the console. Six pages called
`<DataTable rows={…} count={…} emptyDescription={…}>` instead of `data` /
`renderRow` / `emptyDesc`, so `data` kept its default `[]` and every table on
them rendered "nothing here" over a list that was fully loaded. The guard reads
each shared component's own destructured parameter list, so the spec is the
component rather than a list beside it that would drift.

Two more things the same pass turned up, both invisible for the same reason:
`<EmptyState desc=…>` (the prop is `description`, so the second line never
rendered) and `<ClassPicker classValue=…>` (the prop is `classVal`, so the fee
structure page's picker never showed what was selected).

One warning about the prefix check: `Finance` and `Library` were missing from
its list of portals, and it skips any page whose directory it does not
recognise — so the two newest portals were outside the ratchet entirely. If you
add a portal, add it there in the same commit, or it is not being checked.

It is baseline-locked: the counts it allows are the ones present when it was
written, and they may only go down. Adding a new violation fails the suite;
fixing one and forgetting to lower the baseline also fails it, so the number
keeps moving in one direction.
