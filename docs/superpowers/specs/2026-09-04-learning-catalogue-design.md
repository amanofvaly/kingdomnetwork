# Learning catalogue — one surface for coursework and materials

## The problem

A church can author a book, an audiobook, a study guide or a sermon series in
the console and publish it. No visitor can ever reach it.

The server side is complete and unused: `market.listResources` and
`market.resourceDetail` have no client caller, cart pricing resolves resources,
orders create entitlements, and `/me/library` delivers the files. What is
missing is every screen in between. `App.jsx` has no route for a material, the
cards on a church profile are not links, and `market.search` queries `Offering`
only. The one place that names a material — cart cross-sell — links to
`/resources/:slug`, which 404s.

Two further gaps sit underneath the missing screens:

- **Files a church sells are public.** `media.upload` hardcodes
  `visibility: 'public'`, so every paid PDF and audio file is served from a
  permanent `immutable`-cached URL that anyone holding the link can take.
  `canReadPrivate` already carries a branch for buyers; nothing marks the files
  private, so it never runs.
- **Video is half-supported.** `storeUpload` sniffs and accepts MP4 and WebM at
  a 500MB ceiling, but the console file input accepts `application/pdf,audio/*`,
  and `media.serve` ignores `Range`, which browsers require to play or seek
  video at all.

## The shape

`/courses` becomes `/learning`: one catalogue of everything a church teaches or
sells, the way `/credentials` unifies the outcome types. Courses and materials
share a card and a grid; a **Format** filter distinguishes them.

This is deliberate. `DESIGN.md` splits the product into **materials**, which are
bought, and **standing**, which is applied for. A course and a book are both
materials, so they belong on one surface under one set of commerce furniture.
Separating them would draw a line the product does not have.

One new page is unavoidable: a material needs somewhere to live. It goes at
`/materials/:slug`.

### Routes

| Path | Change |
| --- | --- |
| `/learning` | New. The combined catalogue. |
| `/courses` | Redirects to `/learning`, preserving query string. |
| `/courses/:slug` | Unchanged. |
| `/materials/:slug` | New. Material detail. |
| `/resources/:slug` | Redirects to `/materials/:slug`. |

`Cart.jsx` builds `/resources/${slug}` today; it is updated to `/materials`, and
the redirect covers any link already in the wild.

## Server: the combined catalogue

`GET /learning` is the new catalogue endpoint. It answers with one page of mixed
items plus facet counts across both collections, and is what the client calls.

The merge uses a `$unionWith` aggregation rather than two queries reconciled in
Node. Both collections project into a common card shape, then one pipeline
applies `$match`, `$sort` and a `$facet` that returns the page slice and every
facet count together. This keeps pagination and counts honest as either
collection grows; merging in memory would make "page 3 of 47" a fiction and
would need a second pass for facets regardless.

### The common card shape

Both sides project to:

```
kind        'course' | 'book' | 'audiobook' | 'study-guide'
            | 'sermon-series' | 'album' | 'workbook'
slug, title, subtitle, churchSlug
price, compareAtPrice, currency
coverImage, coverAlt
category, level          — courses only, null for materials
minutes                  — totalMinutes | durationMinutes
pages                    — materials only
rating, ratingCount, learners
createdAt
```

`kind: 'course'` is the discriminator. A material carries its `Resource.kind`
directly, so the Format facet is one `$group` over the projected field.

### Query parameters

`q`, `format`, `category`, `level`, `church`, `sort`, `page`, `limit`.

`format` accepts `course` or any `RESOURCE_KINDS` value. `category` and `level`
match courses only; selecting either implicitly narrows to courses, and the
Format facet reflects that.

Sorts: `popular` (learners desc, materials rank last on a null), `rating`,
`newest`, `price-asc`, `price-desc`.

The old `GET /courses` list endpoint stays where it is, unused by the client, so
nothing already calling it breaks. `GET /courses/:slug` is untouched.

## Server: honest delivery

### Private files

`media.upload` reads an optional `x-media-visibility: private` header and
stores the asset accordingly. The console sends it when attaching a file to a
material. The **sample stays public** — it is the thing that sells the item.

`canReadPrivate` already returns true for a buyer holding an `Enrollment`. It
gains one branch: a member of the owning church with `media:write` may read
their own church's files, so the console can preview what it uploaded.

A migration (`007-private-resource-files.js`) flips every asset referenced by a
`Resource.fileMediaIds` to `visibility: 'private'`.

### Range requests

`media.serve` parses `Range` and answers `206 Partial Content` with
`Content-Range` and `Accept-Ranges: bytes`; a request without `Range` keeps its
current `200` behaviour and gains `Accept-Ranges`. A malformed or unsatisfiable
range returns `416`.

The storage contract grows one optional argument:
`stream(key, { start, end })`. `createReadStream` already accepts it, so the
local driver is a pass-through. The contract comment in `storage/index.js` is
updated.

## Client: the catalogue

`Learning.jsx` replaces `Courses.jsx`, keeping its filter-rail structure, URL
state, results bar, empty state and pager. The rail gains a Format group in
first position. The count line reads "12 courses and materials" rather than
naming one type.

Cards come from a shared `MaterialCard` in `components/cards.jsx`, rendered from
the common card shape and used by the catalogue, search results, and church
profiles alike. It carries the kind as a tag, the issuing church by name, and
the price. `CourseCard` stays for the course-shaped call sites that already use
it.

## Client: the material detail page

`Materials.jsx` at `/materials/:slug`, reading `GET /resources/:slug`, which
already returns `{ resource, church, alsoFrom }`.

A header carrying cover, kind, title, subtitle, author, issuing church and
price, and one of two right-hand boxes:

- **Not owned** — price, compare-at, add to basket.
- **Owned** — the files themselves, playable and downloadable in place, with a
  link to `/me/library`.

Below it, a body chosen by the kind of media:

| Media | Body |
| --- | --- |
| PDF — book, study guide, workbook | Description, page count, sample pages inline if a preview exists |
| Audio — audiobook, album | Inline player on the sample; track list from the attached files |
| Video / audio — sermon series | Inline player on the sample clip; episode list |

The player is one small `MediaPlayer` component switching on the asset's
`mimeType` between `<audio>` and `<video>`, both native controls. Nothing here
needs a third-party player, and Range support makes seeking work.

Then the existing `alsoFrom` rail as "More from this church".

The server's `resourceDetail` is extended to return, for the signed-in viewer,
whether they own the item, and the sample asset's url and mime type. It must not
return the paid `fileMediaIds` urls to someone who does not own the item.

## Client: the other two entry points

**Search.** `market.search` gains a `materials` block alongside `offerings`,
matching title, subtitle, author and tags. `Search.jsx` renders it as its own
group under the credential results, using `MaterialCard`. Credentials keep
primacy: standing is what the platform is for, and materials do not compete for
the same row.

**Church profile.** The resource cards in `ChurchDetail.jsx` become
`MaterialCard`s linking to `/materials/:slug`, which ends the dead end that
started this.

## Console

`Resources.jsx` widens its file input to accept `application/pdf,audio/*,video/*`
and maps a video mime to `kind: 'video'`. It gains a **sample** slot writing
`previewMediaId`, described as the part anyone may see before buying. File
uploads send `x-media-visibility: private`; the sample and cover do not.

The page keeps its name in the console — a church thinks in books and sermon
series, not "materials" — but the empty state stops saying "Upload the file once
and it is delivered to every buyer" as though only files were possible.

## Testing

Added to the existing vitest suite:

- **Catalogue** — format filter returns only that kind; paging walks the union
  in the right order; facet counts match the filtered set; `category` narrows to
  courses.
- **Privacy** — a stranger gets 403 for a paid file, a buyer gets 200, a member
  of the owning church gets 200, and the sample is readable by anyone.
- **Range** — a ranged request returns 206 with the right bytes and
  `Content-Range`; an unsatisfiable range returns 416; no `Range` still returns
  200.
- **Detail** — a viewer who does not own the item is not handed the paid file
  urls.

## Out of scope

`readBody` buffers a whole upload in memory, so a 500MB video is 500MB resident
in the Node process. Streaming uploads is separate work and is not part of this.
