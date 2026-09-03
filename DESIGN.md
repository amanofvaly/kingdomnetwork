# Design system — Kingdom Network

## The idea

A network where churches publish what they issue and ministers apply for it.
It should read as serious and specific: light, photographic, and dense with real
information. Trust comes from naming the issuing church everywhere and showing
the people behind it, not from ornament.

Two kinds of thing live here and they are not styled alike. **Materials** —
coursework, books — are bought: they carry a price, a basket and the ordinary
commerce furniture. **Standing** — ordination, licences, certificates — is
applied for: it carries an application fee, a checklist of what the church
requires, and no basket, no discount anchor, no urgency and no badge. Making
that difference visible is the design's first job, because a page that treats
a title like a product is making a claim about the title.

## Type

One face doing all the jobs.

**Geist** — used across the application. Display, body, labels, metadata, buttons, navigation, forms.
Weights 400 and 500; 600 for emphasis inside a paragraph. Loaded as a variable font.

```
--text-xs   12px   metadata, counts, captions
--text-sm   13px   secondary body, form labels
--text-base 15px   body default, buttons
--text-md   16px   lead paragraphs, lesson notes
--text-lg   18px   .lede
--text-xl   22px   h3
--text-2xl  28px   h2 in a section
--text-3xl  36px   page titles
--text-4xl  fluid  hero only
```

Headings carry `-0.02em` to `-0.03em` tracking and `1.12` leading. Body runs at
`1.6`. Uppercase tracking is reserved for `.eyebrow` at 12px/600.

## Colour

Light ground. Deep green carries authority and every primary action. Gold marks
credentials and verification, and appears nowhere else.

```
--bg          #ffffff   default canvas
--bg-warm     #fbf9f5   hero, detail headers, inset panels
--bg-sunken   #f5f2ec   alternating bands
--bg-ink      #14171a   footer, the church-facing band
--bg-green    #0c3b2e   reserved for full-bleed brand moments

--ink         #14171a   primary text
--ink-2       #4c535c   secondary text
--ink-3       #7c848e   metadata
--line        #e6e2da   hairlines
--line-strong #d2ccc0   input and control borders

--green-700   #14563f   primary buttons, links
--green-600   #1a6a4e   verification marks, focus ring
--green-50    #edf5f1   selected states, positive notices

--gold-600    #9a7326   credential and award marks
--gold-50     #faf4e7   issued-credential surfaces
--red-600     #a63d28   errors, discount marks
```

Rules that hold the palette together:

- **Green means action or authority.** Primary buttons, the verified badge, a
  completed step. Never decoration.
- **Gold means a credential.** Certificate tags, the issued passport card, the
  award panel. If it is not something a church awards, it is not gold.
- **The ground alternates.** white → warm → white → sunken → ink. Bands separate
  sections without borders doing the work.

## Shape and depth

Radii stay tight: `4px` tags, `6px` buttons and inputs, `10px` cards and media,
`999px` chips and avatars only. Nothing else is a pill.

The system is close to flat. Cards use a hairline border and gain a 1px shadow on
hover. Real elevation (`--shadow-md`, `--shadow-lg`) is reserved for things that
genuinely float: the sticky application card, the account menu, the hero feature
card, and the console's dialogs and drawers. Focus is a 3px ring, always visible.

## Photography

Every card has a photograph of people. Faces, classrooms, congregations, study.
Images are `object-fit: cover` inside a fixed ratio, and scale 3.5% on card hover.

Assets live in `client/public/media`:

- `scenes/{slug}.webp` at 1600×1067, with an `@800` variant for grids
- `people/{slug}.webp` at 640×800, with an `@200` square for avatars

All sourced from Unsplash and stored locally. `scripts` in the repo history show
the curation and resize pipeline. Replace them per-church as real photography
arrives — nothing in the code assumes a particular file.

## Components

**Buttons** are 44px minimum (52px for `.btn-lg`), 15px Geist at weight 500, with
`24px` horizontal padding. Variants: `primary` (green), `dark`, `outline`,
`ghost`, and the two inverse variants for dark bands.

**Cards** are a flat white box with a hairline border. The issuing church leads —
monogram, name, country, verification mark — then the title, then how it is
issued, then the price. `.price-big` is Geist at `--text-xl`, which makes it the
second-loudest thing on the card after the title. The footer is pushed down with
`margin-top: auto` so prices align across a row.

**The comparison row** (`.offer-row`) is the outcome pages' unit: image, the
listing and its issuer, and a column carrying the application fee, how long a
decision takes, and what is required. Many churches issue into the same outcome,
so the row exists to be scanned down a column — and what differs between them is
what they ask, not what they charge.

**Acquisition tags** say how a credential is obtained — by application, written
assessment, coursework, builds on others, interview, church review. One per
listing, always visible, never repeated by a badge saying the same thing. There
is no "issued instantly" tag for anything that confers standing, because there
is no such listing.

**The checklist** (`.checklist`, `.check-step`) is the same component on the
listing, inside the application and in the church's queue, rendered from one
evaluator. If those three ever disagreed about what someone owes a church, the
platform would be lying to one of them.

**The document is shown before anyone applies.** The certificate or letter
renders live in an iframe with a typed name written into it and a watermark
across it — as a specimen of what the church issues, not as a preview of a
purchase.

**The application card** is sticky and lifts into the warm header band by a
negative margin so the header never leaves a dead half-width column.

**Icons** come from `lucide-react` at `strokeWidth` 1.7 for decorative use and 2.4
for checkmarks. No hand-drawn SVG paths.

## Layout

`--page-max: 1280px` with a fluid `clamp(16px, 4vw, 48px)` gutter. Course grids
run 4-up on wide screens, 3-up under 1080px, 2-up under 820px, 1-up under 560px.

Detail pages are a two-column grid with a 372px sidebar; the catalogue uses a
248px filter rail. Both collapse to one column at 1000px and 900px respectively.

## Merchandising marks

`badge` is the platform's label on a card: Editors' pick, Most requested. Gold
on gold-50, used sparingly — a listing carries at most one, and never one that
repeats its acquisition tag.

**Merchandising never touches standing.** `compareAtPrice` and `badge` are
stripped from ordinations, licences, certificates and diplomas by the model
itself, so no view has to remember not to render them.

## Voice

Short declarative sentences that say what the thing is. State the fact and stop.

- No sentences that argue with an objection nobody raised.
- No qualifiers or disclaimers appended to a claim that did not need one.
- Name the issuer, what is required, how long it takes, and what it costs to
  apply. That is the copy.
- Where a limitation is real — an invitation letter is not a visa, a fee confers
  nothing, civil recognition varies — say it once, plainly, in the place the
  claim is made. Never in a footer, and never only once per site.

## Accessibility

Targets WCAG 2.2 AA. Body text meets 4.5:1 on every ground in the palette.
Focus is always visible. Motion respects `prefers-reduced-motion`. Every
interactive control is a real `button` or `a`, and images carry descriptive
alt text or are marked decorative.

## The consoles

`client/src/styles/admin.css` holds the church and platform consoles. They are
built from these same tokens on purpose: an administrator moving between their
public page and the console should not feel they changed product. The rail is
`--bg-ink`, the working area `--bg-sunken`, and every panel is the same hairline
card the public pages use.

---

*The palette quoted above predates a recolour. The values the application
actually uses are in `client/src/styles/tokens.css`; those tokens kept their
`--green-*` names but hold blues. The rules about what each colour means still
hold — only the hues moved.*
