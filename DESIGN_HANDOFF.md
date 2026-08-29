# Session record — the 1st-Pouf design migration is done

Companion to `HANDOFF.md`, which covers the **backend / delivery** axis and is
still accurate except where noted in §7. This file covers the **frontend design
migration** described in `DESIGN_MIGRATION_PLAN.md`.

**Status: phases 1–6 of the plan are complete and committed.** The app builds,
runs, and was exercised in a real browser against a real signed-in account.
What was *not* covered is in §5 — read that before assuming the migration is
verified end to end. It is not.

## State when this was written (2026-08-30 ~04:35 AEST)

- Branch `frontend`, five commits on top of `683ac5b`:

  | Commit | Scope |
  |---|---|
  | `6d91973` | Phases 1–2 — strip base-lyra, install 1st-Pouf |
  | `adbdd5c` | Phase 3 — chrome + auth screens |
  | `d84b9b8` | Phase 4 — Inbox + Requests |
  | `7d7a93e` | Phases 5–6 — dialogs, composer, player, canvas theme |
  | `ad335af` | Phase 6 — browser pass, wordmark, six real fixes |

- Working tree clean apart from the three untracked `*.md` plans.
- BE on **:8888** (untouched this session). FE on **:5173**.
- **The FE dev server was restarted this session** with `node_modules/.vite`
  cleared. See §6 — this matters and will bite again.

```sh
cd FE && npm run build     # passes, 7491 modules
```

| | Before (`683ac5b`) | After |
|---|---|---|
| CSS | 145.81 kB / 30.47 gzip | **131.12 kB / 25.90 gzip** |
| JS | 2242.69 kB / 664.63 gzip | **2296.55 kB / 683.44 gzip** |
| Modules | 5597 | 7491 |

CSS shrank (App.css's 454 lines and index.css's token blocks are gone). JS grew
by the Radix set + `framer-motion` + `@tabler/icons-react`.

## 1. What changed, in one pass

- `src/components/ui/` (4 shadcn base-lyra files), `src/App.css` (454 lines,
  47 classes) and `src/lib/utils.ts` are **deleted**.
- 17 pouf registry items installed into `src/components/pouf/` (18 files, incl.
  `tone.ts`). `pouf.css` was already there and is **byte-identical to the
  registry's `base.json`** — the installer skipped it, which is the check the
  plan asked for.
- `src/index.css` rewritten 300 → ~230 lines, **positioning only**, built on
  pouf's own custom properties. It is deliberately *not* a Tailwind entry;
  `pouf.css` is the only one and a second `@import 'tailwindcss'` breaks pouf.
- All 12 app components rewritten. `UserProfile.tsx` went from an 8-line stub
  to a real screen (§3).
- `<html data-theme="light">` pins light mode. `.tl-theme__dark` deleted.
- Removed: `@base-ui/react`, `@phosphor-icons/react`,
  `@fontsource-variable/jetbrains-mono`, `tailwind-merge`, `tw-animate-css`.
- `components.json` `iconLibrary` is now `tabler`, not `phosphor`.
- Wordmark restyled to **`uve got mail!`** in all four places (tab title,
  navbar brand, login heading, and the SetUsername sentence — where the mark's
  own `!` ends the sentence, so the period was dropped).

**HANDOFF.md's Bug E is fixed at the root, not patched.** `@import
"tailwindcss"` lived only in `pouf.css`, so `index.css`'s shadcn tokens were
never processed and `bg-popover`/`bg-card` generated no CSS — that is why every
dialog rendered transparent. With base-lyra gone there is one theme entry and
no dead tokens. The scoped `bg-surface`/`text-ink` pins that treated the
symptom died with the files that carried them.

## 2. ⚠️ Two local edits inside `src/components/pouf/`

Both carry a `LOCAL EDIT` banner at the top of the file. **A future
`shadcn add` of either item silently reverts them.** Grep `LOCAL EDIT` after
any re-install.

**`navbar.tsx`** — `NavbarLink` gained an optional `onClick`, spread onto the
desktop *and* mobile anchors. Pouf's Navbar is href-driven; this app has no
router, so links `preventDefault()` and flip `App.tsx` state. Sanctioned by
pouf's own conventions ("you own the file — edit it") and by plan §4.1.

**`controls.tsx`** — **this one is a real bug in the registry item, not a
preference.** Every `render={<X />}` was converted to Radix's `asChild`
(9 sites). `render` is the Base UI / Radix-3 prop, but the item declares
`@radix-ui/react-dialog@^1.1.23` — the latest published version — and that line
understands only `asChild` (`@radix-ui/react-primitive@2.1.10` types the prop
as `asChild?: boolean`; there is no `render` anywhere in its build). Left as
shipped, `render` falls through onto the DOM as an unknown attribute: React
warns, the passed element is discarded, and the primitive renders its default.
Concretely the dialog's close control came out as an unstyled native `<button>`
and Title/Description nested a `<Heading>` inside Radix's own `<h2>`.

`Dialog`'s **Trigger** also gained `asChild` in the same edit — see §4.

## 3. Decisions made this session (don't silently revert these)

Confirmed by the product owner before the work started:

| Decision | Choice |
|---|---|
| tldraw canvas | **Pouf chrome, neutral drawing surface.** Panels/toolbar/selection/focus take pouf's pastels; `--tl-color-background` stays near-white (`#fbfaff`) on purpose — a letter is somebody's drawing, and tinting the paper pushes every stroke and GIF toward one hue. |
| HANDOFF's copy bugs | All three fixed: player `backLabel`, send-dialog placeholder, `alert()` → toast. |
| `UserProfile.tsx` | **Built out.** Placeholder avatar (initials, pouf `Avatar`), deliberately **not** editable — there is no avatar storage on the backend, and a control that can't persist would be a lie. Renames via the existing `POST /user/:id/username`. Adds a 4th navbar tab. |
| Git | Work on `frontend`, one commit per phase. |

Also decided in-flight, with reasons recorded in the commits:

- **Decline** is `tone="pink" variant="quiet"` — pouf has no `destructive`.
- **GIF tiles** stay raw `<button><img>` in a pouf `Grid` (plan §9.6): `Figure`
  takes fixed width/height, which a fluid grid cell can't supply.
- `src/lib/username.ts` is new — the first-login gate and the profile editor
  must not drift on what a valid username is. The backend enforces uniqueness
  but **not shape**.

## 4. Where the plan was wrong

`DESIGN_MIGRATION_PLAN.md` was written *before* the components were installed,
so it transcribed some APIs from the registry JSON rather than the built
source. Three did not survive contact:

- **§4.7 — "replace `#root` with pouf's `Shell`."** `Shell` is
  `grid-template-columns: 260px minmax(0,1fr)` — a Sidebar+main layout. This
  app is navbar-on-top with a full-bleed canvas, so it would leave a dead 260px
  column. A pouf-tokened `.app-shell` replaces the fixed 1126px `#root` instead.

- **§4.2 — `trigger={<span hidden />}` with lifted `open` state.** That assumed
  `Trigger` uses `asChild`. It does not: pouf renders
  `<RDialog.Trigger>{trigger}</RDialog.Trigger>`, so a hidden span sits inside a
  real, visible, unstyled Radix `<button>`. Took the plan's **option (b)**
  instead — each dialog owns its `open` state and renders its own trigger where
  the button belongs (`AddFriendDialog` into the navbar's actions slot,
  `SendLetterDialog` into the share HUD, which only exists while a draft does).
  `App.tsx` lost `addFriendOpen`/`sendOpen` and owns only `draft`.

- **§4.4** — the analysis holds, but `pouf.css` *also* restates the same
  replaced-element reset in its own `@layer base`. Conclusion unchanged
  (`.tl-container :is(...)` at (0,1,1) beats (0,0,1)); the reasoning is now
  written into `tldraw-theme.css` so nobody deletes those rules as redundant.

**A non-finding, recorded so it isn't "fixed" again:** pouf's `Segmented`
renders selected and unselected with *identical* `background` and `color`. That
is deliberate — it signals selection with **depth** (`aria-pressed` plus a
pressed-in cushion), so it survives greyscale and colour-vision differences
(WCAG 1.4.1). Measure `transform` and `box-shadow`, not `background`.

## 5. ⛔ What was NOT verified — read this first

The browser pass ran against one signed-in account (`brianman`) with **an empty
inbox and no friend requests**. So the states with the most new pouf markup
were never rendered with real data:

**Closed in the follow-up pass (§10)**: the populated inbox, the send flow,
delivery, playback as recipient, and mark-read are now all verified.

Still not seen in a browser:

| Not seen in a browser | Why it matters |
|---|---|
| **Requests populated** | `RowCard` rows, `Avatar`, Accept/Decline tones, per-row `loading`. Now the single biggest untested surface. |
| **`SetUsername`** | The first-login gate — the account already had a username. |
| **Profile rename** | The form renders; a rename was never executed, so the success toast and `UsernameTakenError` path are unproven. |
| **`load-error` / `?letter=` share link** | Never exercised. |
| **`Skeleton` loading states** | Only flash briefly. |
| **Mobile navbar dropdown** | At 430px the navbar collapses to a "Menu" `<details>`. The menu was *seen* but never opened and clicked — so **half of the `navbar.tsx` LOCAL EDIT (the mobile anchor's `onClick`) is untested**. |
| **Multi-letter gallery** | Verified at "Letter 1 of 1", where both arrows are correctly disabled. The arrow-key handler and the enabled/disabled boundaries need 2+ letters in one window. |
| **`SendLetterDialog` with no friends** | The label drops the "or" in that branch; only the with-friends branch was seen. |
| **Docker build** | Step 11, still not attempted. |

The old handover's two-account setup (`bouncing` sender / `lepky` recipient)
still exists and is the fastest way to close most of this.

## 6. Operational gotcha that cost time

After `npm install`/`uninstall`, a **dev server that was already running serves
a stale Vite dep graph**: the app renders a blank white page, `#root` empty,
zero stylesheets, and **no console error**. `import('/src/main.tsx')` fails with
"Failed to fetch dynamically imported module" while every URL 200s individually.

Fix, and it is the first thing to try if a blank page appears:

```sh
kill <vite pid>; rm -rf FE/node_modules/.vite; cd FE && npx vite --host
```

## 7. Jobs to be done

Roughly in priority order.

1. **Verify the populated states in §5.** Send real letters between the two
   accounts and walk the gallery. Highest value per minute — it is where the
   new markup is densest and least proven.
2. **Docker build (`docker compose up`).** macOS is case-insensitive; the Linux
   build is not, and the registry's file-name casing is inconsistent
   (`Button.tsx`/`Icon.tsx`/`Input.tsx`/`Segmented.tsx` capitalised;
   `layout.tsx`/`surface.tsx`/`navbar.tsx`/`scrollarea.tsx` not). A wrong-case
   import builds fine here and fails only there. This is the cheapest way to
   catch a whole class of error.
3. **Test the mobile navbar dropdown** (§5) — it is untested LOCAL EDIT code.
4. **Two upstream reports.** (a) pouf's `controls.tsx` `render`-vs-`asChild`
   mismatch (§2) — reproducible, and it breaks every consumer on the current
   Radix. (b) node-cron, carried over from `HANDOFF.md` Bug G.
5. **Backend auth gaps get more exposed.** `HANDOFF.md` lists
   `POST /user/:id/username` as unauthenticated and pre-existing. The new
   Profile screen **puts a UI on exactly that route**, so it now has a front
   door. `accept`/`decline` not verifying the caller, and unauthenticated
   `GET /user/:id`, are unchanged.
6. **Bundle size.** 2296 kB / 683 gzip, over the 500 kB warning. Code-splitting
   tldraw and the player would be the obvious first cut.

## 8. Smaller recommendations

- `scroll-area` is **installed but unused** — the GIF results scroll via
  `.gif-scroll` because `ScrollArea` takes a fixed `maxHeight` string and that
  region is sized by its parent. Either drop the item or leave it; harmless.
- **`.pouf-toasts`'s offset hard-codes the navbar's 64px height** (index.css,
  Toast stack). If the navbar's height ever changes, that number must too.
- **Inbox lost `<time dateTime={...}>`.** Pouf has no `time` primitive and
  `Text` renders a `<p>`, so the machine-readable date is gone. Cheap to
  restore with a plain `<time>` wrapper if it matters.
- The z-index arrangement is the one genuinely fragile thing in `index.css`.
  The canvas HUDs must out-rank tldraw (99998/99999), which put them above
  pouf's entire scale (overlays 50–70, toasts 80), so pouf's **portalled**
  layers are explicitly raised above the HUD band. Anything new that portals to
  `<body>` and must appear over a HUD needs adding to that block.
- `App.css`'s old `@layer base { button { ... } }` reset is gone. Any *raw*
  `<button>` added from here on inherits pouf's `appearance: auto` base rule and
  will look like a native control — use `Button`/`IconButton`, or reset it
  explicitly the way `.gif-tile` does.

## 9. Verified working (browser, signed in)

Login · navbar + all four tabs · inbox empty · requests empty · profile ·
composer + live recorder + tldraw theming · GIF search, autofocus, Segmented,
results grid · player transport, slider, speed popover, playback ·
`AddFriendDialog` incl. the 404 error-toast path · `SendLetterDialog` incl. the
friends list · toast styling and placement · keyboard (Tab order through the
navbar with a visible focus ring, Escape closes a dialog) · HUD wrapping at a
420px stage. **No React warnings in console** — which is the proof the `asChild`
conversion landed, since the shipped `render` would have produced both
unknown-prop and `validateDOMNesting` warnings.


## 10. Follow-up pass — the send-letter failure

Reported symptom: two sends failed at 04:41, leaving **2 `Recording` rows and
0 `Mail` rows** (a `sendMail` that died after `saveRecording`).

**It was not a code bug, and it is not reproducible.** `sendMail` now works
end to end. The only change between the failure and the fix was **restarting
the backend** — the failing process had been up 2h47m. The added logging (see
below) has recorded **zero** failures since.

Be precise about what that means: the original error was never captured, so
the root cause is unproven. It was *process state*, not code. The most
plausible neighbour is `HANDOFF.md`'s **Bug G** — a Prisma statement-result
corruption observed in a long-running process — but Bug G was measured inside
node-cron tasks and `sendMail` is an HTTP handler, so this is a hypothesis and
nothing more. Note also that a reproduction in a **fresh one-shot script
proves nothing here**: Bug G's own table shows a fresh process behaves
correctly while the long-running one does not.

**The durable fix is the logging.** `sendMail`'s catch used to return a bare
500 and discard `error`, so a failing send was undiagnosable — the client said
"Sending the letter failed (500)" and the server log said nothing. It now
`console.error`s before responding. If this recurs, the reason will be in
`BE`'s stdout. Three sibling catches in `mailController.ts` still swallow their
errors the same way; worth the same treatment.

**If it recurs, restart the backend and capture the log** — that is now the
whole diagnostic.

### Verified in this pass

Send by friend picker · send by username · `History` row created on the first
letter between a pair · delivery (`POST /delivery/run` → `{"users":1,
"delivered":1,"archived":0}`) · **populated inbox gallery** (cushion card,
purple NEW badge, formatted date, "Letter 1 of 1", both arrows correctly
disabled at a single letter) · opening a letter · replay as the recipient ·
`PUT /mail/:id/read` · badge clears and the button becomes "Read again" ·
**`backLabel` reads "← Back to inbox"** on the recipient path — the HANDOFF
copy bug, proven fixed on exactly the path it was wrong on · the
`alert()` → toast replacement, seen firing as a yellow warning toast.

### Test data left behind — clean up when convenient

- **Mail 26** `brianman → bomboclat`, held (`received=false`).
- **Mail 27** `brianman → brianman` (a self-send, to reach the inbox from one
  account), delivered and read.
- **3 `Recording` rows**, 2 of them orphaned by the original 04:41 failures.
- **1 `History` row** for the brianman/bomboclat pair.
- **`brianman.scheduledMail` was pushed one hour into the past** to force the
  delivery pass. It will roll forward on the next delivery.

Nothing was deleted — that is the owner's call.

### Operational note

The backend was restarted with `pnpm dev`, which is **nodemon-watched**
(`nodemon --watch src --ext ts`), so `BE/src` edits now reload automatically.
Its stdout still appends to `/private/tmp/claude-501/be3.log`.
