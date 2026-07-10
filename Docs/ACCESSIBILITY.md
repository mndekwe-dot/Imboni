# Accessibility (a11y)

Where Imboni stands on accessibility, what the first pass fixed, and what's
still open. Goal: usable with a keyboard and a screen reader, for staff, parents,
and students who need it.

## First pass — done

Focused on the **shared components that appear on every portal page**, so one fix
benefits all 7 portals.

| Area | Fix |
|---|---|
| **Skip link** | A "Skip to main content" link (visually hidden until keyboard-focused) now lets keyboard users jump past the sidebar to `<main id="main-content">`, which every page renders. |
| **Notification menu — keyboard** | Notification items were clickable `<div>`s with no keyboard access. They're now reachable (`tabIndex`) and activatable with Enter/Space, and the menu closes on `Escape`. |
| **Notification button — label** | The icon-only bell now has a descriptive `aria-label` including the unread count, plus `aria-haspopup` / `aria-expanded`. |
| **Decorative icons** | Material Symbols icons inside labelled buttons/links in the header, sidebar, and notification menu are marked `aria-hidden="true"`, so screen readers don't read "menu menu" etc. |
| **Landmarks** | The sidebar `<nav>` has `aria-label="Main navigation"`. Pages already use `<header>`, `<main>`, and `<nav>` landmarks. |
| **Sidebar toggle** | The collapse button exposes state (`aria-expanded`) and an action-specific label ("Collapse sidebar" / "Expand sidebar"). |
| **Profile link** | The header avatar link has `aria-label="Your profile"`. |
| **Reduced motion** | The route-loading spinner slows under `prefers-reduced-motion`. |

Existing good practices already in place: real `<button>`/`<a>` elements for
actions, `NavLink` sets `aria-current="page"` on the active item, form inputs use
`<label htmlFor>`, `prefers-contrast: high` and `prefers-reduced-motion` media
queries exist, and login/portal forms are properly labelled.

## Still open (follow-ups)

Ranked by value. None are blockers for a pilot, but they're the next steps for a
full WCAG 2.1 AA pass.

1. **App-wide decorative-icon sweep** — this pass marked icons `aria-hidden` in the
   shared layout only. Many page-level Material Symbols icons across the 7 portals
   should get the same treatment (or an accessible label where the icon conveys
   meaning on its own).
2. **Modal focus management** — dialogs should trap focus, return focus to the
   trigger on close, and close on `Escape` consistently. Audit the shared modal
   pattern in `components.css` and the pages that use it.
3. **Colour-contrast audit** — verify text/background pairs (especially muted
   text, badges, and the portal accent colours) meet 4.5:1. Use the built
   `prefers-contrast: high` path as the fallback.
4. **Visible focus indicators** — confirm every interactive element has a clear
   focus ring in both themes; add a global `:focus-visible` style if any are missing.
5. **Data tables** — timetable and results tables should use `<th scope>` and
   captions so screen-reader users can navigate them.
6. **Automated checks in CI** — add `@axe-core/playwright` to the E2E suite to
   catch regressions (run axe on the login page and one dashboard).

## How to test manually

- **Keyboard only:** unplug the mouse. Tab from the top — the first Tab should
  reveal the skip link. You should be able to reach and operate every control.
- **Screen reader:** NVDA (Windows, free) or VoiceOver (Mac). Listen for
  unlabelled buttons ("button" with no name) and decorative icons being read.
- **Zoom:** the page should stay usable at 200% browser zoom.
