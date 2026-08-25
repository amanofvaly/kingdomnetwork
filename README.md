# Kingdom Network

A two-sided marketplace for church-issued standing. Churches list what they
issue — ordination, certificates, ministry licences, affiliation and invitation
letters — and set their own titles, requirements and prices. Ministers compare
across churches, buy, and hold every signed document in a Digital Minister
Passport with a code anyone can verify.

Monolithic MERN app: one repo, one Node process in production.

## Getting started

```bash
npm install            # server deps, then client deps via postinstall
cp .env.example .env   # set MONGO_URI if you are not on a local mongod
npm run seed           # load the marketplace catalogue
npm run dev            # Express :4000 + Vite :5173
```

Requires Node >= 20 and MongoDB.

## The model

**Offering** — one thing a church sells. The church writes it: type, title,
price, and what it requires. Nothing is approved by the platform; a listing is
live when it is published.

**Outcome** — the comparison bucket a listing sits in. Ordination, certification,
ministry licence, church affiliation, invitation letter. Many churches compete
in each one, and the outcome page is where that happens. Eleven churches
currently list ordination between $29 and $290.

**Acquisition mode** — derived from what the church requires, and the single
most important thing on a listing after the price:

| Mode | What happens on purchase |
| --- | --- |
| `instant` | Issued to the passport immediately |
| `assessment` | A paper is unlocked here; passing it issues the credential |
| `coursework` | The named courses unlock; finishing them issues it |
| `credentials` | Held until the buyer also holds the credentials this church names |
| `review` | Sent to the church, issued when they sign |

Requirements chain across churches. Senior Minister at The R.O.C.K. requires an
ordination from The R.O.C.K., a preaching certificate from Beacon Hill and an
administration certificate from Grace Covenant — three churches, one title.

**Credential** — what a person holds. Every issued one renders as a real PDF
(`server/lib/documents.js`) and carries a public verification code.

## Invitation letters

A letter is only worth having when it comes from a church in the country the
buyer is travelling to, so every letter listing carries a destination and is
sold by a church located there. That makes the natural basket cross-border:
ordination from Kampala, invitation from Houston. Two churches, one buyer.

Letters are also the one product bought repeatedly — the duplicate check that
blocks re-buying a credential deliberately exempts them, so a minister buys a
new one for each trip and keeps the previous ones.

## Merchandising

The marketplace is open, so ranking is the only lever the platform holds.
`RANK` in `server/controllers/market.controller.js` sorts by editorial pick,
then paid boost, then how many the market has actually bought. `featured`,
`editorsPick`, `boost` and `badge` are all set per listing.

## Commerce

Basket → checkout → order → issuance. Six payment rails (M-Pesa, Airtel Money,
MTN MoMo, card, PayPal, bank transfer), all running against a simulator until
gateway credentials are configured.

Checkout takes a name, a phone number and an email and creates the account
behind the purchase. There is no password to set. Prices always resolve
server-side; only the last four characters of a payer identifier are retained.

The basket cross-sells: an ordination in the basket offers a letter and an
affiliation, a letter offers a credential.

## Scripts

| Script | |
| --- | --- |
| `npm run dev` | Server and client together |
| `npm run seed` | Reseed the catalogue, leaving user data alone |
| `npm run seed:all` | Reseed and clear users, orders, enrolments, credentials |
| `npm run build` | Build the client |
| `npm start` | Production: one Node process |
| `npm run lint` | Lint the client |

## Structure

```
server/
  models/        Church Offering Course Credential Enrollment Order Review User Instructor
  controllers/   market · checkout · passport · learning · auth
  lib/documents  PDF renderers for certificates and letters
  data/          seed catalogue, outcome taxonomy, assessment banks
  scripts/seed   reseed command

client/src/
  pages/         Home Outcome Listing Search Passport Assessment Dashboard …
  components/    market (offering cards) · Layout · ui · cards
  styles/        tokens · base · app · pages
  ../public/media  locally served photography
```

## API

| | |
| --- | --- |
| `GET /api/home` | merchandised homepage |
| `GET /api/outcomes` · `/api/outcomes/:slug` | taxonomy and the comparison page with facets |
| `GET /api/offerings/:slug` | listing, with requirements resolved against the signed-in buyer |
| `GET /api/offerings/:slug/preview.pdf?name=` | the document, watermarked, with any name on it |
| `GET /api/search` · `/api/suggest` | faceted search and typeahead |
| `GET /api/churches` · `/api/churches/:slug` | directory and profile |
| `POST /api/auth/guest` | checkout account, no password |
| `POST /api/cart/price` · `/api/cart/cross-sell` | server pricing and attach offers |
| `POST /api/orders` | pay and issue |
| `GET /api/me/passport` | everything held, with what each one waits on |
| `GET /api/me/credentials/:id/document.pdf` | the issued PDF |
| `GET|POST /api/me/credentials/:id/assessment` | sit the paper |
| `GET /api/verify/:code` | public verification |

## Seed data

12 churches, 39 listings, 27 courses (778 lessons), 24 instructors, 113 reviews.

Everything carries `demo: true`. **The seven ministries with a `website` field
are real organisations named in `PRODUCT.md` as prospective partners. The
listings, prices, leader photography and issue counts attached to them are
placeholder content those ministries have not supplied.** The other five
churches are invented. Replace both before this is shown outside the project.

## Production

```bash
npm install && npm run build && npm start
```

One Express process serves `/api/*`, the built client, and falls back to
`index.html` for client routing. Set `PORT`, `MONGO_URI` and `JWT_SECRET`.
