# Translation files

One file per domain, per language. These files are what ships — `i18n/index.js`
imports each language's barrel (`<lang>/index.js`), so there is no generated
bundle in between. Reading `fr/teacher.json` is reading exactly what the teacher
pages render.

```
translations/
  en/  fr/  rw/            26 domain files each, same 26 names
    index.js               barrel: 26 imports, one per domain
    account.json  admin.json  …
```

The top-level key of every string is its domain, so the file a key lives in is
readable off the key itself: `teacher.assignments.due` is in `<lang>/teacher.json`.

## Which file covers which page

| File | Covers |
|---|---|
| `account.json` | `pages/Account.jsx` |
| `admin.json` | `pages/Admin/*` |
| `announcements.json` | `components/announcements/`, the four `*Announcement*` pages |
| `auth.json` | `pages/login.jsx`, `pages/PortalLogin.jsx` |
| `common.json` | shared words used everywhere — buttons, statuses, weekdays |
| `dis.json` | `pages/Dis/*` (discipline portal) |
| `dos.json` | `pages/Dos/*` (director of studies portal) |
| `landing.json` | `pages/LandingPage.jsx` |
| `language.json` | `components/ui/LanguageSwitcher.jsx` |
| `matron.json` | `pages/Matron/*` |
| `messaging.json` | `components/messaging/*` |
| `modals.json` | `components/modals/*` |
| `nav.json` | sidebar and page nav labels, used by every portal |
| `parent.json` | `pages/Parent/*` |
| `portal.json`, `portalLogin.json` | portal names and blurbs on `PortalLogin.jsx` |
| `privacy.json`, `terms.json` | `pages/Privacy.jsx`, `pages/Terms.jsx` |
| `publicLayout.json`, `publicNav.json` | `components/PublicLayout.jsx` |
| `roles.json` | role names, used wherever a person is labelled |
| `settings.json` | `pages/Admin/AdminSettings.jsx`, `pages/Dos/DosSettings.jsx` |
| `sidebar.json` | `components/layout/Sidebar.jsx` |
| `student.json` | `pages/Student/*` |
| `teacher.json` | `pages/Teacher/*` |
| `welcome.json` | `components/layout/WelcomeBanner.jsx` |

To see every string one page uses, grep its top-level key:
`grep -o "t('[a-z]*\." pages/Teacher/TeacherClasses.jsx | sort -u`

## Adding a string

Add the key to **all three** languages in the same domain file. `i18n.test.jsx`
fails the build if the three files do not define exactly the same key set, so a
key added to English alone is caught before it ships.

Adding a whole new domain means a new JSON file in each of `en/`, `fr/`, `rw/`
plus a line in each of the three barrels.

## Rules the tests enforce

- **Same keys in all three languages.** Missing and orphaned keys are both errors.
- **No empty strings.**
- **`{{placeholders}}` are identical to English.** The name inside the braces is
  code, not prose. Translating `{{total}}` to `{{àtal}}` leaves i18next unable
  to resolve it, and the raw braces render as visible interface text.
- **No mojibake.** UTF-8 read as cp1252 turns `…` into `â€¦`; it looks fine in a
  diff and renders as gibberish.
- **Plural keys resolve.** Every `_other` key needs its `_one` partner, in every
  language.

Kinyarwanda terminology decisions are settled in [`../GLOSSARY.md`](../GLOSSARY.md).
