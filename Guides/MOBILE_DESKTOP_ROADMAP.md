# Roadmap — Turning Imboni into a PC App & Phone App

A plan for shipping Imboni as **downloadable software**: an installable phone
app (Play Store / App Store) and PC software (`.exe` / `.dmg`). It starts with
the mental model so the choices make sense, then gives the phased roadmap,
stack, costs, and the non-obvious requirements.

---

## Part 1 — The mental model (understand this first)

There is **no hard line between "a website" and "an app."** They can be the
*same code* in different packaging.

Imboni's frontend is React = HTML + CSS + JavaScript. That code runs inside a
**browser engine** (the software that draws web pages). On a laptop that's
Chrome/Edge/Safari; on a phone it's the mobile browser.

The unlock: **a phone or desktop app is allowed to contain a browser engine
inside it.** Put a browser-in-a-box, point it at *your* website only, give the
box an icon — that's an app. The user taps the icon, a full-screen window
opens, and your React app runs inside it. No browser bar in sight. That
embedded browser is called a **WebView** — the bridge between "web" and
"native."

So **you never rewrite the app. You change the packaging** — give it its own
box (with a browser inside) instead of borrowing the user's browser.

### What the "box" buys you

A plain website can't have these; an app box can:

- A **home-screen / desktop icon** (looks installed, not bookmarked)
- A **listing in the app stores** (discoverability + trust)
- Deeper **device access** — real push notifications, camera, files, biometrics
- **Offline** launch and instant open

That's the whole reason app stores and installers exist — not different code, a
different wrapper with more powers.

### The two ways to get the box

| Way | What it means | Effort | Right for you? |
|---|---|---|---|
| **Wrap** (reuse) | Put your existing React app in a native box (WebView) | Low — keep all your code | ✅ Yes |
| **Rewrite** (native) | Rebuild the UI in React Native / Flutter / Swift / Kotlin | High — months, rebuild everything | ❌ No |

You have a *finished, tested* React app. Wrapping reuses ~100% of it.
Rewriting would demolish a house you just built. **Wrap.**

### Where the PWA sits

The PWA already added to Imboni is the **lightest box** — so light it skips the
app store entirely. The browser itself offers "Install app," and it becomes a
full-screen, offline, icon-launched app. It's ~80% of the app feel for zero
extra tooling. The heavier boxes below exist for the last 20%: store presence
and deeper device powers.

---

## Part 2 — Where Imboni is today

- ✅ React frontend (Vite) — the "play" that every theater will perform
- ✅ Django REST backend — the server every version talks to
- ✅ **PWA already built** — installable + offline, no store needed
- ⏳ Backend not yet deployed to a public HTTPS domain (**prerequisite for all
  of the below**)

## Part 3 — The stack

| Target | Tool | Why |
|---|---|---|
| **Phone (iOS + Android)** | **Capacitor** | Wraps the existing Vite build in a native shell; gives native push/camera; publishes to both stores. Reuses ~100% of the code. |
| **PC software** | **Tauri** (recommended) or Electron | Same React app → `.exe`/`.msi`/`.dmg`. Tauri = tiny (~5 MB), modern; Electron = heavier (~100 MB) but most mature. |

Not React Native / Flutter — those are for greenfield or heavy-native UI, not
for wrapping a working web app.

---

## Part 4 — The phased roadmap

### Phase 0 — Deploy the backend to HTTPS *(prerequisite)*
Every installable version talks to the Django API via `VITE_API_BASE`. Nothing
is real until the backend is on a public HTTPS domain (see
`Guides/Backend/DEPLOYMENT_GUIDE.md`). The PWA and native push also *require*
HTTPS.
**Effort:** the existing deployment step. **Cost:** hosting + domain.

### Phase 1 — Ship the PWA install *(days, ~free)*
Add an "Install app" prompt and give staff the (store-free) install steps.
Immediate, installable, offline — ideal for the pilot.
**Effort:** ~2–3 days. **Cost:** $0.

### Phase 2 — Android app via Capacitor *(~1 week + review)*
`npm i @capacitor/core @capacitor/android`, point Capacitor at `dist/`,
generate the Android project, build an `.aab`, submit to Play.
**Effort:** ~1 week. **Cost:** Google Play account **$25 once**. Review: usually
fast.

### Phase 3 — iOS app via Capacitor *(~1–2 weeks + review)*
Same wrapper — **but iOS builds require a Mac with Xcode** (or a cloud-Mac /
Codemagic / EAS if you're on Windows).
**Effort:** ~1–2 weeks. **Cost:** Apple Developer **$99/year** + possibly a
cloud Mac. Review: stricter and slower.

### Phase 4 — Desktop software via Tauri *(~1 week)*
Wrap the same app → signed Windows `.msi` and Mac `.dmg`.
**Effort:** ~1 week. **Cost:** optional code-signing cert (Windows ~$100–400/yr;
Mac cert is part of the Apple account). Unsigned works for internal use but
shows a security warning.

### Phase 5 — Native push notifications
Capacitor upgrades the deferred web-push work into **real native push** (FCM on
Android, APNs on Apple) that reaches a phone's lock screen even when the app is
closed — hooking into the notification service already built.
**Effort:** ~1 week. **Cost:** free (FCM/APNs).

---

## Part 5 — The non-obvious requirements (don't get blindsided)

- **Developer accounts:** Apple **$99/yr**, Google **$25 once**.
- **A Mac is mandatory for iOS** builds (or a paid cloud-Mac service).
- **Code signing** on desktop to avoid "unknown publisher" scare screens.
- **A privacy policy URL** — required by both stores before they'll list you.
- **⚠️ Children's-data store policies — the #1 gatekeeper for a school app.**
  Apple's *Kids Category* and Google's *Designed for Families* have strict
  rules: no third-party ad/tracking SDKs, a clear privacy policy, and
  parental-consent handling. Imboni holds minors' grades, medical, and
  disciplinary records, so these policies **will** apply. Sort this early —
  it's the most common reason education apps get rejected.

---

## Part 6 — Recommended sequence

1. **Deploy backend + ship the PWA install** — real, installable, offline, $0,
   no review. Best for the pilot.
2. **Capacitor → Android** — cheap ($25), reuses the code, real Play listing +
   native push.
3. **iOS + desktop** *after* the pilot proves value — they cost more (Mac,
   $99/yr, signing).

**One-sentence summary:** the React code is the "play"; website, PWA, phone app,
and desktop app are four theaters performing the *same* play — Capacitor and
Tauri build the theaters around the play you already wrote.

---

## Part 7 — Go/no-go checklist per phase

**Before any store submission**
- [ ] Backend live on HTTPS; app points at it via `VITE_API_BASE`
- [ ] Privacy policy written and hosted at a public URL
- [ ] No third-party ad/tracking SDKs in the build
- [ ] App icon + splash screen assets prepared

**Android (Play)**
- [ ] Google Play developer account ($25)
- [ ] Signed `.aab` produced by Capacitor
- [ ] "Designed for Families" questionnaire completed

**iOS (App Store)**
- [ ] Apple Developer account ($99/yr)
- [ ] Access to a Mac + Xcode (or cloud Mac)
- [ ] Kids Category rules reviewed

**Desktop (Tauri)**
- [ ] Decide signed vs unsigned (internal vs public distribution)
- [ ] Build + test `.msi` (Windows) and `.dmg` (Mac)
