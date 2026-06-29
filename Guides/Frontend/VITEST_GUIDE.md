# Frontend Testing Guide — Vitest + React Testing Library

This guide explains every tool used in the Imboni frontend test suite, the patterns we settled on, the gotchas we hit, and a cheat sheet you can copy-paste from.

---

## Table of Contents

1. [Tool Overview](#1-tool-overview)
2. [Project Setup](#2-project-setup)
3. [Core Concepts](#3-core-concepts)
4. [Writing Tests — Step by Step](#4-writing-tests--step-by-step)
5. [Patterns Used in This Codebase](#5-patterns-used-in-this-codebase)
6. [Common Gotchas & Fixes](#6-common-gotchas--fixes)
7. [Cheat Sheet](#7-cheat-sheet)

---

## 1. Tool Overview

| Tool | Role |
|---|---|
| **Vitest** | Test runner (like Jest but Vite-native — zero extra config) |
| **React Testing Library (RTL)** | Renders components and provides user-centric queries |
| **@testing-library/jest-dom** | Extra matchers like `toBeInTheDocument()` |
| **jsdom** | Simulates a browser DOM inside Node.js so tests can run without a real browser |

### Why Vitest instead of Jest?

This project already uses Vite. Vitest reuses the same config, same transforms, and the same module aliases — no separate Babel setup. Run speed is also significantly faster.

### Why React Testing Library instead of Enzyme?

RTL tests the component from the user's perspective (by finding text, roles, labels) rather than by inspecting internal props/state. Tests written this way survive refactors because they don't care *how* the component works, only *what* it shows.

---

## 2. Project Setup

### Files added

```
Frontend/
  vitest.config.js          ← Vitest configuration
  src/test/
    setup.js                ← Runs before every test file
    test-utils.jsx          ← Custom render helper + re-exports
```

### `vitest.config.js`

```js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,        // no need to import describe/it/expect
    environment: 'jsdom', // simulate browser DOM
    setupFiles: ['./src/test/setup.js'],
  },
})
```

### `src/test/setup.js`

```js
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()               // unmount components between tests
  localStorage.clear()   // clean up session data
})
```

### `src/test/test-utils.jsx`

```jsx
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnnouncementsProvider } from '../context/AnnouncementsContext'

export function renderWithRouter(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AnnouncementsProvider>
        {ui}
      </AnnouncementsProvider>
    </MemoryRouter>
  )
}

export function setSessionUser(user) {
  localStorage.setItem('imboni_user',    JSON.stringify(user))
  localStorage.setItem('imboni_access',  'fake-access-token')
  localStorage.setItem('imboni_refresh', 'fake-refresh-token')
}

export * from '@testing-library/react'
```

### `package.json` (test script)

```json
"scripts": {
  "test": "vitest run"
}
```

Run all tests: `npm test`  
Run one file: `npx vitest run src/pages/Admin/AdminStaff.test.jsx`  
Watch mode:   `npx vitest`

---

## 3. Core Concepts

### Queries — how to find elements

RTL provides query functions. The naming convention is:

```
[get|query|find] + [All?] + By + [Role|Text|LabelText|PlaceholderText|AltText|Title|TestId]
```

| Prefix | Throws if missing? | Returns |
|---|---|---|
| `getBy…` | Yes | Single element |
| `queryBy…` | No (returns null) | Single element or null |
| `findBy…` | Yes (async, waits) | Promise → element |
| `getAllBy…` | Yes | Array of elements |
| `queryAllBy…` | No | Array (may be empty) |
| `findAllBy…` | Yes (async) | Promise → array |

**Priority order** (prefer earlier ones — they match what users see):

1. `getByRole` — best; uses ARIA roles
2. `getByLabelText` — great for form inputs with `<label>`
3. `getByPlaceholderText` — decent for inputs without labels
4. `getByText` — good for visible text
5. `getByAltText` — for images
6. `getByTestId` — last resort; adds `data-testid` to source

### `waitFor` and async tests

Components that fetch data need `waitFor`:

```jsx
// waits up to 1s (default) for the condition to become true
await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
```

Or use `findBy*` which is `waitFor` + `getBy*` combined:

```jsx
const el = await screen.findByText('Alice')
expect(el).toBeInTheDocument()
```

### Mocking with `vi.mock`

Place at the top of the test file (Vitest hoists it automatically):

```js
vi.mock('../../api/student', () => ({
  getStudentProfile: vi.fn(),
  getStudentResults: vi.fn(),
}))
```

Then in each test, configure what the mock returns:

```js
getStudentProfile.mockResolvedValue({ name: 'Alice', grade: 'S3A' })
```

Always `vi.clearAllMocks()` in `beforeEach` so mocks don't leak between tests.

### `fireEvent` vs `userEvent`

`fireEvent` fires a single synthetic event (synchronous, simpler). `userEvent` simulates full browser sequences (click → focus → mousedown → mouseup → click). For this codebase we use `fireEvent` — it's enough for all our interaction tests.

```js
fireEvent.click(screen.getByRole('button', { name: /Save/ }))
fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Alice' } })
```

---

## 4. Writing Tests — Step by Step

### Template

```jsx
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { MyPage } from './MyPage'
import { getMyData, createMyData } from '../../api/my-module'

// 1. Mock the API
vi.mock('../../api/my-module', () => ({
  getMyData:    vi.fn(),
  createMyData: vi.fn(),
}))

// Always mock notifications (used by every page via useNotifications)
vi.mock('../../api/notifications', () => ({
  getNotifications:      vi.fn().mockResolvedValue([]),
  markNotificationRead:  vi.fn(),
}))

// 2. Stub <dialog> if any Modal is used
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close    = function () { this.removeAttribute('open') }
})

describe('MyPage', () => {
  // 3. Reset mocks between tests
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state while data is in flight', () => {
    getMyData.mockReturnValue(new Promise(() => {})) // never resolves
    renderWithRouter(<MyPage />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows empty state when there is no data', async () => {
    getMyData.mockResolvedValue([])
    renderWithRouter(<MyPage />)
    await waitFor(() => expect(screen.getByText('Nothing here yet')).toBeInTheDocument())
  })

  it('renders items after data loads', async () => {
    getMyData.mockResolvedValue([{ id: 1, name: 'Alice' }])
    renderWithRouter(<MyPage />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
  })

  it('creates a new item via the modal', async () => {
    getMyData.mockResolvedValue([])
    createMyData.mockResolvedValue({ id: 2, name: 'Bob' })
    renderWithRouter(<MyPage />)
    await waitFor(() => expect(screen.getByText('Nothing here yet')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Add/ }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bob' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))

    await waitFor(() => expect(createMyData).toHaveBeenCalledWith({ name: 'Bob' }))
  })
})
```

---

## 5. Patterns Used in This Codebase

### renderWithRouter

Every page component needs React Router (`useParams`, `<Link>`) and the `AnnouncementsProvider`. The helper wraps both:

```js
renderWithRouter(<AdminStaff />)
renderWithRouter(<StudentResults />, { route: '/student/results' })
```

### setSessionUser

Pages that read from `localStorage` for the logged-in user:

```js
setSessionUser({ id: 1, first_name: 'Alice', last_name: 'M', role: 'student' })
renderWithRouter(<StudentDashboard />)
```

### Never-resolving promise for loading state

```js
getMyData.mockReturnValue(new Promise(() => {})) // hangs forever → loading state stays
renderWithRouter(<MyPage />)
expect(screen.getByText('Loading…')).toBeInTheDocument()
```

### Mocking the notifications hook

Every portal page calls `useNotifications()` which calls `getNotifications()`. Without mocking it, the test hits a real fetch call and fails. Always add:

```js
vi.mock('../../api/notifications', () => ({
  getNotifications:     vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))
```

### Native `<dialog>` stub

The shared `Modal` component calls `dialog.showModal()`. jsdom does not implement this method, so every test that opens a modal needs the stub:

```js
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close    = function () { this.removeAttribute('open') }
})
```

Place this once per file in `beforeAll`, not in `beforeEach`.

### Scoping queries with `within`

When the same text appears in multiple places (e.g. sidebar nav + page content, or a list card + a modal), scope the query:

```js
import { within } from '../../test/test-utils'

const card = screen.getByText('Alice').closest('.staff-card')
fireEvent.click(within(card).getByRole('button', { name: /Edit/ }))
```

### Multiple "Add" buttons

Pages often have several "Add Something" buttons for different card sections. Scope to the card:

```js
const card = screen.getByText('Dormitories').closest('.card')
fireEvent.click(within(card).getByRole('button', { name: /Add/ }))
```

---

## 6. Common Gotchas & Fixes

### 1. Material Symbols icon glyphs in button accessible names

The icon font renders its name as literal text. A button like:

```jsx
<button>
  <span className="material-symbols-rounded">save</span>
  Save Changes
</button>
```

Has accessible name `"save Save Changes"`, not `"Save Changes"`.

**Fix:** Use unanchored regex — `/Save Changes/` not `/^Save Changes$/`.

```js
// Wrong
screen.getByRole('button', { name: /^Save Changes$/ })

// Right
screen.getByRole('button', { name: /Save Changes/ })
```

### 2. `getByText` matches ancestor elements too

`screen.getByText('House Captains')` will match both a `<div>House Captains</div>` AND an `<h2><span>home</span> House Captains</h2>` because RTL matches any element whose full textContent normalizes to the query.

**Fix:** Use `getAllByText` when you just need to assert presence, or use a selector:

```js
// Assert at least one match exists
expect(screen.getAllByText('House Captains').length).toBeGreaterThan(0)

// Or scope to the specific element
screen.getByText('House Captains', { selector: '.disc-stat-label' })
```

### 3. Label/input association (`getByLabelText`)

`getByLabelText('Name')` only works when the label has `htmlFor` pointing to the input's `id`:

```jsx
// This works with getByLabelText
<label htmlFor="name-input">Name</label>
<input id="name-input" ... />

// This does NOT
<label>Name</label>
<input ... />
```

If you find `getByLabelText` failing on a label that looks correct, the component is missing the `htmlFor`/`id` pairing — fix the component.

### 4. Radio inputs inside wrapping labels

When radio buttons are styled as clickable pill labels:

```jsx
<label>
  <input type="radio" value="boys" /> Boys
</label>
```

The radio's accessible name is "Boys". Use:

```js
// Right — the radio input is the interactive element
fireEvent.click(screen.getByRole('radio', { name: 'Boys' }))

// Wrong — there is no button with name "Boys"
fireEvent.click(screen.getByRole('button', { name: /Boys/ }))
```

### 5. `<select>` vs `<button>` for ClassPicker

The `ClassPicker` component (used across Teacher/DOS/Matron pages) renders `<select>` dropdowns, not buttons. To check a section option exists:

```js
// Right
expect(screen.getByRole('option', { name: 'O-Level' })).toBeInTheDocument()

// Wrong — ClassPicker doesn't render buttons for section names
screen.getByRole('button', { name: /O-Level/ })
```

To change a select value:

```js
fireEvent.change(screen.getByRole('combobox', { name: /Section/ }), { target: { value: 'O-Level' } })
```

### 6. `client.js` double-unwrap

`client.js` has a response interceptor that already unwraps `response.data`. Any API function that also does `.then(r => r.data)` will resolve to `undefined` in production. This was found and fixed in `api/student.js` and `api/dos.js`.

When writing tests, if your mock returns `{ name: 'Alice' }` but the component renders nothing, suspect a double-unwrap in the API module.

### 7. UTC timezone off-by-one in dates

```js
new Date().toISOString() // "2026-06-29T21:00:00Z" in UTC+3
                         // .split('T')[0] gives "2026-06-29" not "2026-06-30"
```

Fix with a local date formatter:

```js
function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
```

---

## 7. Cheat Sheet

### Imports

```js
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within, act } from '../../test/test-utils'
```

### Mocking

```js
vi.mock('../../api/teacher', () => ({
  getTeacherProfile: vi.fn(),
}))

// In test:
getTeacherProfile.mockResolvedValue({ name: 'Mr. Bob' })
getTeacherProfile.mockRejectedValue(new Error('Network error'))
getTeacherProfile.mockReturnValue(new Promise(() => {})) // forever-pending

// Check it was called:
expect(getTeacherProfile).toHaveBeenCalled()
expect(getTeacherProfile).toHaveBeenCalledWith({ id: 1 })
expect(getTeacherProfile).toHaveBeenCalledTimes(1)
```

### Queries quick reference

```js
screen.getByText('Alice')                           // exact text
screen.getByText(/alice/i)                          // regex, case-insensitive
screen.getByRole('button', { name: /Save/ })        // ARIA role + accessible name
screen.getByRole('heading', { name: /Dashboard/ })  // h1–h6
screen.getByRole('combobox')                        // <select>
screen.getByRole('option', { name: 'O-Level' })     // <option>
screen.getByRole('radio', { name: 'Boys' })         // <input type="radio">
screen.getByRole('checkbox', { name: /Active/ })    // <input type="checkbox">
screen.getByLabelText('Email')                      // input with <label htmlFor>
screen.getByPlaceholderText('Search…')              // input placeholder
screen.getByDisplayValue('current value')           // input current value
screen.queryByText('Error')                         // null if not found (no throw)
screen.getAllByRole('button')                        // array of all buttons
await screen.findByText('Loaded')                   // async, waits up to 1s
```

### Assertions

```js
expect(element).toBeInTheDocument()
expect(element).not.toBeInTheDocument()
expect(element).toBeVisible()
expect(element).toBeDisabled()
expect(element).toBeEnabled()
expect(element).toHaveTextContent('Alice')
expect(element).toHaveValue('alice@example.com')
expect(element).toHaveAttribute('href', '/home')
expect(element).toHaveClass('active')
expect(screen.getAllByRole('row').length).toBe(3)
```

### Events

```js
fireEvent.click(element)
fireEvent.change(input, { target: { value: 'new text' } })
fireEvent.change(select, { target: { value: 'option-value' } })
fireEvent.submit(form)
fireEvent.keyDown(element, { key: 'Enter', code: 'Enter' })
```

### Async

```js
await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument())
await waitFor(() => expect(myMock).toHaveBeenCalled(), { timeout: 3000 })
const el = await screen.findByText('Done')
```

### Setup boilerplate per file

```js
// Always: mock notifications
vi.mock('../../api/notifications', () => ({
  getNotifications:     vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

// If any modal opens: stub <dialog>
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close    = function () { this.removeAttribute('open') }
})

// Always: reset mocks between tests
beforeEach(() => vi.clearAllMocks())
```

### Typical test structure

```js
it('creates a record via the modal', async () => {
  // 1. Set up mocks
  getItems.mockResolvedValue([])
  createItem.mockResolvedValue({ id: 99, name: 'New Thing' })

  // 2. Render
  renderWithRouter(<ItemsPage />)

  // 3. Wait for initial load
  await waitFor(() => expect(screen.getByText('No items yet')).toBeInTheDocument())

  // 4. Interact
  fireEvent.click(screen.getByRole('button', { name: /Add Item/ }))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Thing' } })
  fireEvent.click(screen.getByRole('button', { name: /Save/ }))

  // 5. Assert API was called correctly
  await waitFor(() => expect(createItem).toHaveBeenCalledWith({ name: 'New Thing' }))
})
```

---

## Test File Locations

All test files sit next to the component they test:

```
src/
  api/                    ← api/*.test.js
  hooks/                  ← hooks/*.test.js
  utils/                  ← utils/*.test.js
  components/
    layout/               ← layout/*.test.jsx
    modals/               ← modals/*.test.jsx
    ui/                   ← ui/*.test.jsx
    timetable/            ← timetable/*.test.jsx
  pages/
    Admin/                ← AdminStaff.test.jsx, AdminDashboard.test.jsx, …
    Dis/                  ← DisActivities.test.jsx, DisSettings.test.jsx, …
    Dos/                  ← DosAttendance.test.jsx, DosResults.test.jsx, …
    Matron/               ← MatronBoarding.test.jsx, …
    Parent/               ← ParentTimetable.test.jsx, …
    Student/              ← StudentDashboard.test.jsx, …
    Teacher/              ← TeacherAssignments.test.jsx, …
```

Total: **755 tests** across **131 files** — 0 failures as of June 2026.
