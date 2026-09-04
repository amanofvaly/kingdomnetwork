# Credentials IA, apply flow, and the material catalogue

**Date:** 2026-09-04
**Status:** Approved, ready for planning

## The governing rule

Kingdom Network has two flows and one rule that separates them:

**A credential is applied for. A material is bought. The fee buys the church's
consideration, never the credential.**

```
CREDENTIALS                              MATERIALS
listing (read requirements)              catalogue (browse)
  → apply: confirm + pay                   → basket
  → church opens your file                 → checkout + pay
  → work the requirements over time        → owned immediately
  → decision → credential issued
```

The left column is a relationship that unfolds over weeks. The right is a
transaction that completes in minutes. The codebase already asserts this in
prose — `server/models/Offering.js`, `server/controllers/commerce.controller.js`
and `client/src/pages/Checkout.jsx` all say so in comments. The interface does
not yet agree. Every change below exists to make it agree.

All credentials will carry real requirements. The 39 seeded offerings currently
have zero form fields, attestations, documents and references; this is
unrepresentative seed data and **must not** be designed around.

## How this work is judged

Design is the deliverable. A surface that works but looks unconsidered is not
finished. Two existing surfaces are the standard every new one must meet:

- **`client/src/pages/ChurchRegister.jsx`** — art-led, staged reveal, one clear
  action per moment, a live preview that makes the abstract concrete, generous
  and deliberate whitespace.
- **The homepage** — art-directed hero, editorial rails, real controls over
  designed artwork.

Non-negotiables carried from those references:

- Use `client/src/styles/tokens.css`. Do not invent spacing, colour or type
  values. The palette is blue-led (`--blue-700` primary) with gold reserved for
  credentials and verification, coral and aqua as sparing accents.
- Motion uses the two named curves, `--ease-expo` and `--ease-soft`. Do not
  introduce a third.
- **Never import `components/admin/kit.jsx` into a public page.** Admin
  primitives on a public surface are the direct cause of the "looks like work"
  complaint.
- Mobile is judged as harshly as desktop. Wasted vertical space and hollow
  section shells on a sparse record are specific, named failures.
- Sections with no content are omitted entirely, never rendered empty.

## 1. Navigation and information architecture

`NAV` in `client/src/components/Layout.jsx:14` becomes:

```
Credentials · Courses · Churches
```

A new `/credentials` hub fronts all five outcomes. The existing outcome routes
(`/ordination`, `/certification`, `/ministry-license`, `/church-affiliation`,
`/invitation-letter`, declared at `client/src/App.jsx:66`) are unchanged and
become its children. No redirects are required.

The hub replaces two disconnected tabs that implied the apply→learn→earn story
without ever telling it. It should carry that narrative once, with the weight of
a homepage section rather than a category index: what a credential is, that
churches decide, that a fee starts a process.

**Design direction.** Art-led header in the homepage idiom. The five outcomes as
substantial editorial tiles — not a plain grid of links — each carrying its own
imagery, a from-price, and a count of issuing churches. Ordination leads; it is
the largest category at 12 of 39 offerings.

## 2. Courses and books

**Catalogue.** `/courses` gains a **kind** filter in the existing sidebar
alongside category, level, church and sort: `All · Coursework · Books & guides`.
Reuse the `FilterItem` pattern at `client/src/pages/Courses.jsx:87`.

**Detail page.** New `/resources/:slug`. This also repairs a dead link:
`client/src/pages/Cart.jsx:42` already routes resource line items to
`/resources/${slug}`, which 404s today.

**Server.** `GET /resources` and `GET /resources/:slug` already exist at
`server/routes/public.js:27-28`. `resolveItems` in
`server/controllers/commerce.controller.js` already prices, orders and enrols
resources. No server changes needed.

**Design direction.** A book is not a course and should not wear a course card.
It has no duration, no lesson count, no level — it has a cover, a kind, an
author and a page count. Give it a card that leads with the cover at a book's
aspect ratio rather than a 3:2 video still, and a detail page built around the
object rather than a curriculum accordion.

**Note:** zero resources exist in the database. The surfaces will be empty until
books are authored. Seed a small number so the work is visible.

## 3. The apply flow

`client/src/pages/Apply.jsx` loses its six-stage machine (`STAGES` at line 21)
entirely and becomes **one confirm-and-pay screen**:

- Church and credential identity
- Who you are applying as
- What happens after payment, in plain language
- The fee and its refund policy
- One button

**Requirements stay on the listing.** `client/src/pages/Listing.jsx:215` already
renders a `<Requirements>` component from `/offerings/:slug`. This is an
emphasis and layout change, not new plumbing. The listing is where someone reads
what the church demands and decides to commit.

**Documents, references and form answers move out of apply** and into the
application workspace (section 4). Under the governing rule they are
post-payment work — collecting them beforehand frames an ongoing relationship as
a form to finish in one sitting, which is the true cause of the click count.

**The account gate is removed.** The dead-end at `Apply.jsx:56` ("You need an
account first") is replaced by inline account creation on the same screen, using
the existing `POST /auth/guest` endpoint that `Checkout.jsx` already uses. No new
backend.

Signed-out path: **six page loads becomes one.**

**Design direction.** This screen handles money for something non-refundable
once review begins. It must feel deliberate and calm, not like a checkout.
No basket language, no cross-sell, no discount, no urgency. The refund policy is
read, not buried. One primary action, unmistakable.

## 4. The application workspace

`client/src/pages/Applications.jsx` is rebuilt as a purpose-built page with its
own stylesheet.

**What is wrong today.** It composes `FileDrop`, `StatusPill` and `Textarea`
from `components/admin/kit.jsx` with `detail-grid`, `buy-card`, `checklist`,
`timeline` and `a-kv` — five unrelated style systems plus inline styles, on a
public page. A representative record (`APP-2026-CZWYF4`, `fee_pending`) has 4
steps, **0 documents** and **1 timeline entry**, so the page renders a stack of
near-empty section shells. On mobile `detail-grid` collapses to one column and
the aside falls to the bottom, stranding the primary action below the fold.

**What it becomes.** The place the applicant does the work, not a receipt.

- Art-led header carrying the church's identity and the credential
- **One unmistakable next action, above the fold on mobile**
- The requirement checklist read as a journey with progress, not a table
- Absorbs document upload and reference entry from apply
- Activity present but subordinate — it is history, not the task
- Empty sections omitted entirely

**Design direction.** Mobile-first, in the church-registration idiom. A sparse
application must look intentional rather than skeletal — this is the specific
failure being corrected. Gold is available here, since this surface is about a
credential.

## 5. The /me dashboard rail

The rail already exists — `StoryRail` at `client/src/components/me/feed.jsx:298`,
styled `me-stories` at `client/src/styles/me.css:1120`, fed by `storiesFrom()` at
`client/src/pages/me/Home.jsx:29`, backed by `/me/dashboard` which returns
`pending` for every non-terminal application. It needs elevating, not inventing.

**Changes:**

- Each tile names a **next action** — "Pay $45", "Sit paper", "Book interview",
  "Resume" — instead of a bare title. A fee-blocked application and a
  60%-complete course currently look identical.
- **Ranked by what is blocking you**, most urgent first.
- **Startable suggestions are included**, but strictly after real obligations and
  visually distinct, so the rail cannot be mistaken for advertising. This
  separation is a requirement, not a preference — an obligation list that
  contains marketing stops being trusted as a to-do.
- The rail leads the page and survives an empty feed. Today it is wrapped in a
  generic `Section` with nothing announcing it.

**Design direction.** The Instagram/TikTok story idiom is already the right one
and is already implemented — a progress ring driven by the `--pct` custom
property. Keep the social texture; add the dashboard semantics. The feed remains
a feed; the rail makes it also a place to resume.

## 6. Pesapal

The mock is not a stub left behind — `server/lib/pesapal/index.js` selects the
gateway from `PESAPAL_ENV`, and a real client already sits beside it in
`client.js`.

```
PESAPAL_ENV unset   → local mock gateway
PESAPAL_ENV=sandbox → real Pesapal (cybqa.pesapal.com/pesapalv3)
PESAPAL_ENV=live    → real Pesapal (pay.pesapal.com/v3)
```

**Work:** document obtaining sandbox credentials, verify the sandbox round trip
end to end, and rebuild the mock pay page (`server/lib/pesapal/mock.js:58`) in
the token system, clearly marked a development gateway. Its hardcoded hex values
predate the blue palette and are now visibly wrong.

## 7. Data cleanup

Three published offerings carry outcomes no route serves — `diploma`, `license`,
`affiliation`. A migration in `server/scripts/` normalises them onto the
canonical five (`diploma → certification`, `license → ministry-license`,
`affiliation → church-affiliation`), making them reachable by category.

## Phasing

Each phase ships working and is judged on look and feel before the next begins.

| Phase | Scope |
|---|---|
| **A** | Nav, `/credentials` hub, outcome migration |
| **B** | Apply collapse, inline guest account, Pesapal sandbox + restyled dev gateway |
| **C** | Application workspace rebuild |
| **D** | Books catalogue and detail page, `/me` rail |

## Testing

- **Server** (vitest, `server/__tests__/`, following the existing integration
  pattern): applying while signed out creates the account and the application;
  resource pricing and ordering resolve end to end; the outcome migration is
  idempotent.
- **UI**: verified by driving the running app, on mobile and desktop viewports.
  Acceptance for every phase is visual — the surface is compared against the
  church-registration flow and the homepage, and a sparse record is checked for
  hollow sections and wasted mobile space.

## Out of scope

- Reworking the manage/admin console
- Changing how churches author offerings or requirements
- Payment provider work beyond Pesapal configuration and the dev gateway restyle
- Any change to the credential issuance or verification model
