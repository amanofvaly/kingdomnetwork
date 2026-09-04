Plan written. Here's the shape of it.

  Yes — I understand the ask, and the exploration confirmed the 
  diagnosis exactly. Churches get a real console at /manage/:churchSlug
  with 16 sections and a shared shell. Personal accounts get five
  orphaned routes wrapped in the marketing layout, no shared nav, and
  /dashboard labelled three different things in three places. There is
  no place. That's what this builds.

  What I'm reusing vs. building. The token layer in tokens.css is
  complete and stays. The utility kit in app.css (.wrap, .band*,
  .grid-*, .btn-*, .media, .scrim, .eyebrow) is the shared vocabulary —
  the area extends it, never forks it. ui.jsx, cards.jsx and market.jsx
  components come across as-is. What's genuinely new is the shell, the
  motion layer, and a vibrant component kit.

  The registration flow's actual technique, carried over: full-bleed
  photography under two-gradient scrims; display type at letter-spacing:
  -.04em; the .is-started morph where one surface transforms rather
  than navigating (outgoing layer blurs and scales away, incoming fades
  in on a delay) — which I'm using for the first-run → populated
  transition, so the area becomes alive rather than swapping pages; and
  objects that genuinely float with 0 32px 80px shadows and slow idle
  drift.

  On empty states — you were right to flag it, and it changed the build
  order. The area's hardest surface is a fresh database, so I'm building
  it first, not last. Every list routes through one ZeroState primitive
  (art + one sentence + exactly one action), each section gets its own
  zero state rather than a generic one, and the unstamped PassportBook
  becomes an aspirational artifact instead of an error. Verification
  explicitly fails if any surface shows a bare empty box.

  Three things worth flagging:
  - Closing the gaps needs only three new endpoints. Notifications, the
    full profile block, notificationPrefs and password change are
    already fully supported server-side and simply have no UI — that's
    client work only.
  - One is a real bug, not a polish item: a user can buy a book today
    and has no way whatsoever to retrieve it (Resource.fileMediaIds is
    never returned to the purchaser). /me/library fixes it.
  - Rather than add a fourth copy of the auth guard, I extract one
    shared <Gate> and use it in the new shell. Migrating the other three
    onto it I've left explicitly out of scope.

  Applications.jsx is the one file needing care — it exports both the
  list (replaced) and ApplicationDetail (a deep flow that stays), so it
  gets split rather than deleted.

────────────────────────────────────────────────────────────────────────
 Ready to code?
     
 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 The User Area — a dedicated, vibrant home for personal accounts

 Context

 Kingdom Network gives churches a polished, shell-based console at
 /manage/:churchSlug (16 sections, shared Rail/ConsoleHeader/kit.jsx)
 and platform staff a matching one at /admin. A personal account gets
 neither. Its experience is five orphaned top-level routes —
 /dashboard, /account, /passport, /orders, /applications — each wrapped
 only in the public marketing Layout, each fetching its own data, with
 no shared shell and no persistent nav between them. The only way to
 move between them is a dropdown in the marketing header, where
 /dashboard is labelled three different things depending on where you
 look ("My account" at Layout.jsx:143, "My learning" at
 Layout.jsx:191).

 The individual pages are functionally complete; the problem is
 architectural. There is no place. A signed-in minister never feels
 they have entered their own zone.

 This builds that zone from scratch — the same way ChurchRegister.jsx
 was built from scratch in 5213cee rather than patched onto the dead
 758-line Onboarding.jsx it replaced. It inherits the design system of
 the homepage, listing page, church profile and registration flow, but
 turns the energy up: photography-led, gradient-rich, animated. It is
 explicitly not the flat dark-rail console idiom of /admin and /manage.

 Decisions locked with the user:
 - Personal accounts only. /manage/* (church) is untouched. An account
   is personal or church, never both — already enforced by
   User.accountKind and requirePersonal.
 - Namespace /me/*. Old personal routes redirect in, then their files
   are deleted.
 - Immersive full-bleed shell: own chrome, own dark rail, no marketing
   header, no footer, art to the edges.
 - Photography-led + rich gradients. Accent colour used sparingly, one
   tone per section.
 - First-run home and per-section zero states. No empty boxes anywhere.
 - Close all four data gaps: notifications inbox, full
   profile/settings, giving + payments ledger, library downloads +
   interviews.
 - Deep task flows (assessment, interview booking, course player) keep
   working and inherit the new tokens; their full rebuild is Phase 2.

 ---

 What already exists (reuse, do not rebuild)

 Tokens — client/src/styles/tokens.css. Complete and good. --ink
 #211e3b, --bg-ink #24204a, --bg-warm #fff9ed, --bg-sunken #f5f2ff; the
 --green-* ramp is actually indigo/blue (--green-700 #3157a4);
 --gold-*, --coral #e86852, --aqua #1e8d91; --s-1..9,
 --r-sm/md/lg/full, --shadow-sm/md/lg, --text-xs..4xl, --header-h 68px,
 --page-max 1280px, --gutter clamp(16px,4vw,48px), --focus. Add only
 motion tokens (below).

 Kit — client/src/styles/app.css. .wrap, .band*, .stack-2..7, .row*,
 .grid-2/3/4 with their collapse queries, .btn-* (44px baseline, -sm 36
 / -lg 52), .chip, .tag, .eyebrow, .lede, .clamp-1/2/3, .num, .media +
 -4x3/16x9/3x2/1x1, .scrim, .field/.input/.select/.textarea, .panel,
 .notice, .skeleton, .spinner, .section-head. Use these throughout —
 the area adds to this vocabulary, it does not fork it.

 Components — client/src/components/ui.jsx (Stars, Verified, Monogram,
 Avatar, Price, Spinner, ErrorState, Breadcrumbs,
 SkeletonCard/SkeletonGrid), cards.jsx (CourseCard, CourseRow),
 market.jsx (ACQUISITION map, AcquisitionTag, OutcomeIcon,
 OfferingCard, confersStanding()). All reused as-is.

 Auth — client/src/lib/auth.jsx. useAuth() → { user, memberships,
 ready, login, logout, ... }. user carries id, name, email, role,
 accountKind, status, avatar, country, city, phone, timezone,
 hasPassword, ministryRole, ministry, bio, emailVerified,
 notificationPrefs, createdAt.

 Endpoints that already return exactly what the area needs:
 - GET /me/dashboard (learning.controller.js:12) → { pending[] (with
   outstanding steps, church, offering, infoRequest), courses[]
   ({enrollment, course, church}), credentials[], stats{issued,
   waiting, courses, completed} }. Calls advanceAllFor() first, so it
   self-heals.
 - GET /me/passport (passport.controller.js:24) → { holder,
   credentials[] (with expired, renewalDueInDays, disclosures),
   applications[], counts{issued, expired, inProgress, letters} }.
 - GET /me/entitlements, GET /me/credentials/:id/document.pdf, GET
   /orders, GET /orders/:reference.
 - GET /me/notifications + POST /me/notifications/read
   (notification.controller.js) — fully built, zero client usage.
   Returns { notifications, unread }.
 - PATCH /auth/me (auth.controller.js) — already accepts timezone, the
   whole ministry{yearsInMinistry, currentRole, congregation,
   denomination, priorCredentials} block,
   notificationPrefs{applicationUpdates, interviewReminders,
   courseProgress, marketing}, and password/currentPassword.
   Account.jsx exposes none of these.

 No animation, charting, form or date library exists. Do not add one —
 hand-roll, matching client/src/lib/format.js.

 ---

 The design language of the area

 Lifted from ChurchRegister.jsx + pages.css:177-338, which is the
 reference for "built from scratch, beautiful":

 1. Full-bleed photography under layered scrims. 100svh-class art with
    a two-gradient scrim (one directional for text legibility, one from
    the bottom), e.g. linear-gradient(90deg, rgba(22,17,55,.92) 0%,
    rgba(28,20,64,.7) 38%, rgba(18,15,47,.08) 72%),
    linear-gradient(0deg, rgba(17,14,42,.56), transparent 58%).
 2. Oversized display type, hard negative tracking. clamp(2.7rem,
    4.4vw, 4.5rem), line-height: .95, letter-spacing: -.04em. Gold
    rule-and-caps accent for kickers (--gold-100 #ffe1a3, .1em
    tracking, uppercase, with a 28px ::before hairline).
 3. State-driven transformation, not navigation. The .is-started
    pattern: one surface morphs — outgoing layer opacity: 0; transform:
    scale(.94) translateY(-4%); filter: blur(10px) over .8s
    cubic-bezier(.16,1,.3,1), incoming layer fades in on a .18s delay.
    Use this for the first-run → populated home transition and for
    section entry.
 4. Objects that float. box-shadow: 0 32px 80px rgba(15,10,62,.34),
    slow 7s ease-in-out infinite idle drift, oversized decorative rings
    (::before with a 90px border, border-radius: 50%, pushed
    off-canvas).
 5. Existing motifs to carry over: the issued-credential gold sweep
    linear-gradient(90deg, var(--green-700), var(--gold-600),
    var(--green-700)) on a 4px rule (.cred.issued::before);
    currentColor-tinted image scrims (.category-image::after); hover
    image zoom scale(1.035) on transform .5s cubic-bezier(.2,.6,.2,1);
    horizontal scroll-snap-type: x mandatory rails on mobile.

 Motion layer (new). Only 5 keyframes exist in the whole app. Add to
 tokens.css (purely additive):
 --ease-expo: cubic-bezier(.16, 1, .3, 1);   /* promote: already used
 by the register flow */
 --ease-soft: cubic-bezier(.2, .6, .2, 1);   /* promote: already used
 by media zoom */
 --dur-1: .18s;  --dur-2: .32s;  --dur-3: .7s;
 New keyframes in me.css: me-rise (translateY + fade tile entrance),
 me-art-settle (hero photo scale(1.06)→1 with saturate(.85)→1, modelled
 on church-art-arrive), me-float, me-sheen (gradient sweep across
 passport/credential surfaces), me-ring (progress-ring stroke draw).
 Stagger with an inline custom property — style={{ '--i': i }} and
 animation-delay: calc(var(--i) * 55ms) — never with JS timers.
 base.css already neutralises all animation under
 prefers-reduced-motion, so this is safe by default.

 Per-section identity. Each section owns a signature photograph and one
 accent tone, set as --tone on the section root so children inherit it
 (the .issuer-palette-* technique from Home.jsx, which switches 8
 custom properties at once per index). Assets already on disk in
 client/public/media/: scenes/auditorium-crowd,
 scenes/congregation-gathering, scenes/bible-being-taught,
 scenes/seminar-room, scenes/audience-seated (each with @800 variants),
 people/* (~34 portraits), church-registration-cross.jpg,
 hero-featured-henry.jpg. No new assets required.

 ┌──────────┬─────────────┬──────────────────────────────────────┐
 │ Section  │    Tone     │            Signature art             │
 ├──────────┼─────────────┼──────────────────────────────────────┤
 │ Home     │ --green-700 │ time-of-day rotation across scenes/* │
 ├──────────┼─────────────┼──────────────────────────────────────┤
 │ Journey  │ --green-600 │ scenes/seminar-room                  │
 ├──────────┼─────────────┼──────────────────────────────────────┤
 │ Passport │ --gold-600  │ church-registration-cross.jpg        │
 ├──────────┼─────────────┼──────────────────────────────────────┤
 │ Learning │ --aqua      │ scenes/bible-being-taught            │
 ├──────────┼─────────────┼──────────────────────────────────────┤
 │ Library  │ --coral     │ scenes/books-colorful                │
 ├──────────┼─────────────┼──────────────────────────────────────┤
 │ Giving   │ --gold-700  │ scenes/congregation-gathering        │
 └──────────┴─────────────┴──────────────────────────────────────┘

 ---

 Architecture

 New files

 client/src/styles/me.css                  the area's stylesheet
 (import in main.jsx AFTER pages.css)
 client/src/lib/guard.jsx                  one shared auth gate (see
 note below)
 client/src/components/me/Shell.jsx        the area shell: rail,
 chrome, bell, mobile tab bar
 client/src/components/me/kit.jsx          the vibrant component kit
 client/src/pages/me/Home.jsx              /me            — first-run +
 populated variants
 client/src/pages/me/Journey.jsx           /me/journey    —
 applications in flight + interviews
 client/src/pages/me/Passport.jsx          /me/passport   — issued
 credentials, renewals
 client/src/pages/me/Learning.jsx          /me/learning   — courses +
 progress
 client/src/pages/me/Library.jsx           /me/library    — purchases,
 downloads, orders
 client/src/pages/me/Giving.jsx            /me/giving     — gifts +
 unified statement
 client/src/pages/me/Inbox.jsx             /me/inbox      —
 notifications
 client/src/pages/me/Profile.jsx           /me/profile    — identity +
 ministry biography
 client/src/pages/me/Settings.jsx          /me/settings   — password,
 prefs, email, sessions

 kit.jsx — the component vocabulary

 - AreaHero — full-bleed photo, layered scrim, --tone, oversized
   display type, gold kicker. The area's signature surface; every
   section opens with one.
 - Tile — the area's card primitive. Photographic or gradient variant,
   inherits --tone, me-rise entrance with stagger, hover lift.
 - ZeroState — the anti-empty-box primitive: artwork + one orienting
   sentence + exactly one action. Every list in the area routes through
   this when empty. Never render a bare .empty.
 - StatBloom — a large font-variant-numeric: tabular-nums figure over a
   gradient underlay, with label. Replaces the admin Stat tile.
 - ProgressRing / ProgressMeter — hand-rolled SVG (no chart library),
   me-ring stroke draw.
 - PassportBook — the passport as a physical artifact, stamped or
   unstamped. Carries the gold sweep rule and me-sheen.
 - SectionHead, Rail (snap-scroll), Timeline (application step
   progression).

 Shell.jsx — the immersive shell

 - Rail: deep indigo, but gradient-and-photographic rather than flat —
   a radial-gradient highlight over linear-gradient(180deg, #24204a,
   #1a1638), generous spacing, an identity block (avatar, name,
   ministryRole), and large soft nav items whose active state picks up
   that section's --tone. Deliberately unlike the admin Rail's dense
   grouped lists.
 - Nav: primary — Home, Journey, Passport, Learning, Library, Giving.
   Secondary group — Inbox (unread dot), Profile, Settings. Sign-out
   pinned to the bottom.
 - Header: contextual greeting, notification bell driven by unread from
   GET /me/notifications, avatar menu. No marketing nav, no footer —
   MeShell renders its own <Outlet/> outside Layout entirely, the way
   ChurchRegister and Learn already do.
 - Mobile (max-width: 1000px, matching the existing header-collapse
   breakpoint): rail becomes a bottom tab bar for the five primary
   sections plus a "more" drawer. Compact top bar retains greeting +
   bell.
 - Guard: three near-duplicate guards exist today (RequireAuth in
   App.jsx, and inline bodies in ChurchShell at admin/Shell.jsx:65-88
   and AdminShell at :194-209). Rather than add a fourth, extract one
   <Gate> into client/src/lib/guard.jsx handling not ready / not signed
   in / wrong account kind, and use it in MeShell. Migrating the other
   three onto it is out of scope — noted, not done.

 Routing — client/src/App.jsx

 Add a /me block wrapping MeShell, alongside the existing /manage and
 /admin blocks (not inside Layout). Redirect the old personal routes
 in: /dashboard → /me, /account → /me/profile, /passport →
 /me/passport, /orders → /me/library, /applications → /me/journey.
 RequireAuth's existing behaviour of bouncing accountKind === 'church'
 users to /manage/:churchSlug is preserved by <Gate>.

 Deep flows keep their current paths and stay working:
 /applications/:reference, /applications/:reference/assessment,
 /applications/:reference/interview, /orders/:reference, /learn/:slug.

 The first-run home

 Derived client-side from data already returned — no new endpoint, no
 new flag:

 const isFirstRun = stats.issued === 0 && stats.waiting === 0
                 && stats.courses === 0 && orders.length === 0;

 First run (the approved mock): full-bleed photograph + scrim,
 "Welcome, {name}." and a line naming the emptiness honestly rather
 than hiding it; three photographic pathway tiles — seek standing (→
 /search), study a course (→ /courses), complete your profile (→
 /me/profile, with the real 2-minute cost stated); and below,
 PassportBook in its unstamped state as an aspirational artifact, not
 an error.

 Populated: the same AreaHero with a time-of-day greeting, then — in
 priority order, because it mirrors what GET /me/dashboard already
 decides is important — waiting on you (outstanding steps[] and any
 unresolved infoRequest), upcoming interviews, learning in progress
 with ProgressMeter, recent passport stamps, and a giving glance.

 The transition between the two uses the .is-started morph, so a user
 who completes their first action sees the area become alive rather
 than swap pages.

 Zero states are designed per section, not generic — each with its own
 art, sentence and single action. Journey empty ≠ Passport empty ≠
 Library empty. This is the single most important detail in the build:
 on a fresh database every surface must still look intentional.

 ---

 Server work

 Three genuinely new endpoints; the rest is client-only against
 existing routes. Add to server/routes/apply.js (already requireAuth +
 requirePersonal on the /me prefix — inherit that, do not re-declare).

 1. GET /me/statement → new statement handler. Payment.find({ userId })
    shaped by kind (application-fee, renewal, course, resource,
    donation) with amount, church, date, status, and the frozen
    platform-fee/net split. This is the unified "everything I've paid"
    view — including gifts, which GET /orders never returns. Powers
    /me/giving.
 2. GET /me/library → enrollments of kind resource/course joined to
    Resource, returning fileMediaIds to the purchaser only, plus GET
    /me/resources/:slug/download serving through the existing
    MediaAsset + server/lib/storage/local.js path (reuse
    media.controller.js serve's visibility enforcement and resolveKey
    traversal check — do not write new file-serving logic). Closes a
    real bug: a user can currently buy a book and have no way
    whatsoever to retrieve it.
 3. GET /me/interviews → Interview.find({ userId }) upcoming-first with
    church, offering and joinUrl. The ICS export at GET
    /interviews/:id/calendar.ics already exists — link it, don't
    rebuild it.

 GET /me/notifications, POST /me/notifications/read and PATCH /auth/me
 need no server work at all — they already support everything Inbox,
 Profile and Settings require.

 Add server/__tests__ coverage for the three new handlers alongside the
 existing vitest suites, including the authorization case that
 matters: one user must not be able to download another's purchased
 resource.

 ---

 Cleanup

 Dead code confirmed unreferenced by App.jsx or any import, safe to
 delete: client/src/pages/Onboarding.jsx (758 lines, superseded by
 ChurchRegister.jsx), client/src/pages/ChurchBannerConcept.jsx (73
 lines), the empty client/src/pages/member/ directory, and
 server/controllers/checkout.controller.js (263 lines, a second unused
 implementation of order listing that no route points at — confirm
 before removing).

 Superseded by the area, delete after redirects land: Dashboard.jsx,
 Account.jsx, Passport.jsx, Orders.jsx. Applications.jsx is only partly
 superseded — it exports both the list (replaced by /me/journey) and
 ApplicationDetail (a deep flow that stays). Split it: keep the detail,
 drop the list.

 Then fix the label chaos in components/Layout.jsx: the marketing
 header's AccountMenu currently offers five separate links with
 /dashboard labelled "My account" (:143) next to /account labelled
 "Account" (:146), and "My learning" on mobile (:191). Replace all of
 it with a single entry into the area.

 ---

 Build sequence

 1. Motion tokens in tokens.css; me.css scaffold with keyframes and the
    --tone contract.
 2. guard.jsx, Shell.jsx, kit.jsx — shell renders with stub sections.
    Verify the shell first: no marketing chrome, rail active states,
    mobile tab bar, reduced-motion.
 3. /me Home — first-run variant first (it's the harder and more
    important one), then populated.
 4. Journey, Passport, Learning — against existing /me/dashboard and
    /me/passport.
 5. Server: the three new endpoints + tests.
 6. Library, Giving, Inbox, Profile, Settings.
 7. Routes, redirects, deletions, AccountMenu fix.

 ---

 Verification

 Run the app: npm run dev (concurrently starts nodemon server/index.js
 + Vite on the client).

 Empty state — the priority. Point the server at a database with a
 fresh user and no seed data, sign up a personal account via /signup,
 and walk every one of the nine /me routes. Every surface must look
 composed: art, orientation, one action. Fail the build if any surface
 renders a bare empty box, a zero-value stat with no context, or a
 spinner that resolves to nothing.

 Populated state. npm run seed:all, sign in as a seeded personal
 account, and walk the same nine routes. Confirm the first-run →
 populated morph, stats accuracy against GET /me/dashboard,
 renewalDueInDays surfacing on the passport, and course progress
 matching Enrollment.progress.

 Account separation. Sign in as a church account and hit /me — <Gate>
 must bounce to /manage/:churchSlug. Sign out and hit /me — must bounce
 to /login and return after signing in. Confirm requirePersonal still
 403s the three new endpoints for a church account.

 Gap closures. Bell shows unread from GET /me/notifications and clears
 via POST /me/notifications/read. Profile saves timezone and the full
 ministry{} block; Settings changes a password and toggles all four
 notificationPrefs. /me/giving shows a donation that GET /orders does
 not. A purchased resource downloads; a second user gets 403 for the
 same URL.

 Regression. The deep flows still work end to end: start an
 application, upload a document, sit an assessment, book an interview,
 play a course, complete checkout. Old bookmarked URLs redirect
 correctly.

 Checks. npm test (vitest) and npm run lint (oxlint) clean. Verify at
 1440 / 1024 / 768 / 390 widths, and with prefers-reduced-motion:
 reduce set.