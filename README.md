# Kingdom Network

A two-sided marketplace for church-issued learning. Churches publish courses,
certificates and multi-stage ordination pathways; people enrol, pay, work through
the material, and receive credentials into a Digital Minister Passport with a
public verification code.

Monolithic MERN app: one repo, one Node process in production. Express serves the
API under `/api` and the built React bundle for everything else.

## Getting started

```bash
npm install            # server deps, then client deps via postinstall
cp .env.example .env   # set MONGO_URI if not using a local mongod
npm run seed           # load the catalogue into MongoDB
npm run dev            # Express :4000 + Vite :5173
```

Open http://localhost:5173.

Requires Node >= 20 (see `.nvmrc`) and MongoDB, local or Atlas.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Server (nodemon) and client (Vite) together |
| `npm run seed` | Reseed the catalogue; leaves users, orders and credentials alone |
| `npm run seed:all` | Reseed and also clear users, orders, enrolments, credentials |
| `npm run build` | Build the React app into `client/dist` |
| `npm start` | Production: one Node process on `$PORT` |
| `npm run lint` | Lint the client (oxlint) |

## What is built

**Learner side.** Search and filtered catalogue, course detail with full curriculum,
church profiles, credential pathways, basket, checkout, a course player with
progress tracking and working quizzes, a dashboard, and the passport.

**Commerce.** Real end-to-end flow: basket → checkout → order → enrolment →
lifetime access. Six payment rails are offered (M-Pesa, Airtel Money, MTN MoMo,
card, PayPal, bank transfer) and every one runs against a built-in simulator until
gateway credentials are configured. Prices are always resolved server-side from the
database; client-supplied prices are ignored. Only the last four characters of a
payer identifier are retained on the order.

**Credentials.** Completing every lesson on a course issues its certificate into the
holder's passport with a verification code. `/verify/:code` is a public page that
resolves a code to the credential, the holder and the issuing church.

**Not built yet.** Church-facing money — payouts, platform commission, sponsorship
escrow, donations, subscriptions. Church admin tooling for authoring courses and
issuing credentials by hand.

## Structure

```
server/
  index.js                 app entry: middleware, API mount, static client
  config/                  env + mongoose connection
  models/                  Church Instructor Course Pathway Review User
                           Order Enrollment Credential
  controllers/             auth · catalog · checkout · learning
  routes/index.js          every route, mounted in one file
  middleware/              asyncHandler, auth, notFound, errorHandler
  data/                    seed catalogue (see below)
  scripts/seed.js          reseed command

client/src/
  App.jsx                  routes
  styles/                  tokens · base · app · pages
  lib/                     api · auth · cart · format · useAsync
  components/              Layout · cards · ui
  pages/                   one file per route
  ../public/media/         locally served photography
```

## The seed catalogue

`server/data/` holds 12 churches, 24 instructors, 27 courses (778 lessons across
their curricula), 6 credential pathways and 113 reviews.

Course outlines are authored by hand in `data/courses/*.js` using the `sec()`
helper, which keeps a curriculum readable as an outline. `data/lesson-content.js`
then expands every outline entry into the lesson notes, key points and quiz
questions the player renders, grounding each one in that lecture's own title, its
section and its course.

Everything carries `demo: true`. **The seven ministries with a `website` field are
real organisations named in `PRODUCT.md` as prospective partners — the courses,
prices, ratings and leader photography attached to them are placeholder content,
not anything those ministries have supplied.** The other five churches are invented.
Replace both before this is shown to anyone outside the project.

## API

| Method | Route | |
| --- | --- | --- |
| GET | `/api/health` | uptime and Mongo state |
| GET | `/api/home` | everything the homepage needs |
| GET | `/api/courses` | list with `q`, `category`, `level`, `church`, `sort`, `page` + facets |
| GET | `/api/courses/:slug` | course, church, instructors, reviews, related |
| GET | `/api/pathways`, `/api/pathways/:slug` | pathways, with bundle savings |
| GET | `/api/churches`, `/api/churches/:slug` | directory and profile |
| GET | `/api/search` | across courses, churches and pathways |
| GET | `/api/verify/:code` | public credential verification |
| POST | `/api/auth/signup`, `/api/auth/login` | returns a bearer token |
| GET/PATCH | `/api/auth/me` | current user |
| GET | `/api/payment-methods` | the rails offered at checkout |
| POST | `/api/cart/price` | resolve a client basket to server prices |
| POST/GET | `/api/orders`, `/api/orders/:reference` | place and read orders |
| GET | `/api/me/dashboard`, `/api/me/passport`, `/api/me/entitlements` | |
| GET/POST | `/api/learn/:slug`, `/api/learn/:slug/progress` | player and progress |

## Conventions

- ES modules throughout (`"type": "module"` in both package.json files).
- Controllers wrap handlers in `asyncHandler` so rejections reach `errorHandler`.
- Errors return `{ success: false, message }`; success returns `{ success: true, data }`.
- Config is read once in `server/config/env.js`.
- Auth is a bearer JWT in `localStorage`, sent by `client/src/lib/api.js`.

## Production

```bash
npm install && npm run build && npm start
```

One Express process then serves `/api/*`, static assets from `client/dist`, and
falls back to `index.html` for any non-API path so client routing survives a
refresh. Point pm2, systemd, Render, Railway or Fly at `npm start` with `PORT`,
`MONGO_URI` and `JWT_SECRET` set.
