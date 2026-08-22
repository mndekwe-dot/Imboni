# Where does a style go?

One question, four possible answers. Work down the list and stop at the first
one that fits.

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
| "Nothing here yet" | `EmptyState` |
| A row of filter chips or tabs | `FilterBar` / `TabGroup` |
| A class / stream selector | `ClassPicker` |
| A dialog | `Modal` |
| A dropdown | `Select` |
| Paging controls | `PaginationBar` |

Its CSS lives once, in `components.css`, under the component's own class names
(`portal-stat-*`, `welcome-banner-*`, and so on). **Change it there and every
portal changes.** That is the whole point.

If a component is close but not quite right, add a prop or a modifier class to
the shared component. Do not copy its markup into your page and rename the
classes — that is how one stat tile became nine.

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
- no colour literals outside `index.css`

It is baseline-locked: the counts it allows are the ones present when it was
written, and they may only go down. Adding a new violation fails the suite;
fixing one and forgetting to lower the baseline also fails it, so the number
keeps moving in one direction.
