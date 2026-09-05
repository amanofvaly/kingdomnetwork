# UI backlog

Running list of interface defects and refinements. Ordered roughly simplest → hardest.
Status: `todo` · `doing` · `done` · `deferred`

Keep this file updated as items are fixed — one line of *what changed* per item, so the
next person does not have to re-derive it from the diff.

---

## 1. Back links land in the footer area — `done`

**Symptom.** Following a back link (or any link) from a long page dropped the visitor
partway down the next page, usually level with the footer.

**Cause.** `Layout` reset scroll on route change, but `/me/*`, `/manage/*`, `/admin/*`,
`/church/register`, `/give/*` and `/learn/*` are routed *outside* `Layout` (App.jsx), so
those pages never reset. `/applications/:ref → /me/journey` is exactly that crossing.

**Fix.** `useScrollTop()` hoisted to `App`, so every route resets, and it skips the reset
when the browser is restoring a real history entry (back/forward).
Files: `client/src/lib/useScrollTop.js` (new), `client/src/App.jsx`, `client/src/components/Layout.jsx`.

## 2. Whole homepage scrolls horizontally on phone — `done`

**Cause.** `.issuer-swipe-cue` is pinned `right: -9px` inside `.issuer-rail-shell`, which is
itself a full-`100vw` bleed sitting flush to the viewport edge. Nine pixels of overflow.

**Fix.** Cue pulled inside the bleed, and `overflow-x: clip` on `html, body` as the guard
(`clip` does not create a scroll container, so the sticky header still sticks).
Files: `client/src/styles/base.css`, `client/src/styles/pages.css`.

## 3. Header drifts sideways on phone, logo touches the screen edge — `done`

Same root cause as #2: a sticky header is only sticky vertically, so horizontal page scroll
drags it off the left edge. Fixed by #2. Also gave the header a small `padding-inline`
floor on narrow screens so the mark never sits hard against the bezel.
Files: `client/src/styles/app.css`.

## 4. Verify link missing from the mobile menu — `done`

Added *Verify a credential* to `MobileNav`, under the three main destinations.
File: `client/src/components/Layout.jsx`.

## 5. Hero search placeholder — `done`

"What are you looking for?" said nothing about what is searchable.
Now: "Ordination, certificates, churches…".
File: `client/src/pages/Home.jsx`.

## 6. Footer text — `done`

Rewrote the blurb and the bottom line; the city list was decorative and read as offices
the network does not have.
File: `client/src/components/Layout.jsx`.

## 7. Footer: two columns on phone — `done`

`.footer-grid` collapsed to a single column below 520px — five stacked lists is a very long
scroll. Now: brand spans both columns, link lists sit two-up.
File: `client/src/styles/app.css`.

## 8. Homepage section labels — `done`

- "Popular right now" → "Most applied for"
- "Our picks / Selected by our team" → "Chosen by ministry leaders"
- "Churches on the network" → "Who issues on Kingdom Network"
File: `client/src/pages/Home.jsx`.

## 9. Invitations section rework — `done`

The section was a plain four-up grid identical to the two rails above it, so the one
genuinely different product on the page read as more of the same. Rebuilt as a dark
band that says what an invitation letter is, names the destinations first, and states
plainly that it is not a visa. On a phone the four letters became a swipe rail rather than
four full-height cards.
Files: `client/src/pages/Home.jsx`, `client/src/styles/pages.css`.

## 10. Requirement label "Builds on others" is confusing — `done`

Relabelled the acquisition modes in the visitor's own terms, e.g.
`credentials` → "Other credentials required", `assessment` → "Assessment required",
`coursework` → "Courses required", `interview` → "Interview required". Help text rewritten to
match ("You must already hold the credentials this one builds on").
File: `client/src/components/market.jsx`.

## 11. Filters and sort misaligned on the results bar — `done`

`.results-bar` is a two-child flex row, but the ≤620px rule redefined it as a
three-column grid, so the sort control landed in the middle column. Rewritten as a flex
row with the sort pinned right at every width, and Learning's bar flattened to match Search
and Outcome. Also added the `.wide-only` utility, which two pages already referenced and no
stylesheet defined.
Files: `client/src/styles/pages.css`, `client/src/styles/app.css`, `client/src/pages/Learning.jsx`.

## 12. Filter button does nothing on phone — `done`

`.catalogue > aside { order: 2 }` put the filter panel *below* the entire results grid, so
tapping Filters opened a panel several screens down. The panel is now a bottom sheet on
phone — scrim, header, scrollable list, sticky *Show results* — via a shared `FilterSheet`
used by all three catalogue pages.
Files: `client/src/components/FilterSheet.jsx` (new), `client/src/styles/pages.css`,
`client/src/pages/Learning.jsx`, `client/src/pages/Outcome.jsx`, `client/src/pages/Search.jsx`.

## 13. Church card verified badge is too heavy — `done`

The pill was a white capsule with a shadow and the full word. Now a small solid green chip
with a white icon and label.
Files: `client/src/components/cards.jsx`, `client/src/styles/app.css`.

## 14. Church card clamps are backwards on phone — `done`

Name was clamped to one line and the address to two. Swapped: the name gets two lines and
the location moved onto the cover as a single truncating line (showing `city`, which already
carries the state — "Santa Rosa Beach, Florida, United States" was three commas on a 165px
card). Course count joins it on the cover on wider screens.
Files: `client/src/components/cards.jsx`, `client/src/styles/app.css`.

## 15. Card curation — move secondary meta onto the image — `done`

A `.cover-meta` strip on `OfferingCard` (kind of credential · issued count), `MaterialCard`
and `CourseCard` (format · duration or pages) and `ChurchCard` (location). It sits outside
the cover link, which is `aria-hidden`, so the facts stay real content.

One rule came out of testing it: **a designed jacket keeps its own facts.** The material
covers in `public/media/materials/*.svg` are authored jackets that already carry church,
kind and extent in their composition; a strip over one repeats every word and reads as UI
pasted onto a poster. So `isDesignedJacket()` sends those cards' facts back to the body,
and the strip is for photographs. No artwork was edited.
Files: `client/src/components/cards.jsx`, `client/src/components/market.jsx`, `client/src/styles/app.css`.

**Found while testing:** `.card` set a background but not a colour, so a card dropped onto a
dark band (the new invitations section) inherited that band's white text and every title
disappeared. Fixed on `.card` itself.

## 16. "List what you already issue" CTA — text and phone layout — `done`

Rewrote the copy and rebuilt the band for narrow screens (image first, tighter list,
full-width actions).
Files: `client/src/pages/Home.jsx`, `client/src/styles/pages.css`.

## 17. Verify page — `partly done`, redesign still open

**Tested — passes.** Against the running server: `KNDEMOA1` returns issued + church, a
lowercase code resolves (the controller upper-cases), an unknown code returns 404, and
revoked is reported as revoked rather than as missing.

**Bug found and fixed.** The seeded credentials carry no denormalised `holderName`, so the
response omitted it and the page rendered "Held by" with nothing after it. `verify` now
falls back to the holder's `User.name`. Confirmed: `holderName: 'Grace Achieng'`.
File: `server/controllers/passport.controller.js`.

**Redesign: not done, needs your call.** The brief was to mention blockchain, and nothing in
the codebase is on-chain — credentials are Mongo documents with a `verifyCode`. I won't
write "recorded on a public blockchain and cannot be altered" on the one page a consulate
or a denomination relies on. Two ways forward:

- Redesign around the record it actually keeps, with anchoring named as planned and dated.
- Build the anchoring: hash on issue, write it to a chain, show the transaction. Real work —
  model, issue flow, chain + RPC, a funded key, retries, backfill. A project, not a polish item.

## 18. QR code for a church's giving page — `done`

`qrcode-generator` (zero dependencies) added to the client; `<QrCode>` draws it as a single
SVG path with horizontal runs merged, at error-correction level Q — these get scanned off a
screen from the back of a room.

Lives in the church console under **Giving → Share your giving page**, with the link, a copy
button and a downloadable image.
Files: `client/src/components/QrCode.jsx` (new), `client/src/pages/manage/Donations.jsx`.

## 19. Church share card: banner + QR — `done`

`<ShareCard>` previews the church's banner, mark, name and code, and paints a 1080×1350 PNG
on a canvas for download. On the public profile a **Share** action opens it; the console
reuses the same component for the giving link.
Files: `client/src/components/ShareCard.jsx` (new), `client/src/pages/ChurchDetail.jsx`,
`client/src/styles/admin.css`, `client/src/styles/pages.css`.

---

## Verified

- `npm test` — 182 passing, 14 files.
- `npm --prefix client run build` — clean; `oxlint` adds no new warnings.
- Checked in Chrome at 414px: no horizontal scroll on the homepage
  (`scrollWidth === clientWidth`), filter sheet opens over the results, results bar aligns,
  church cards and footer as described, Verify in the mobile menu.
