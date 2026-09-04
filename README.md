# Kingdom Network

A platform for church-issued standing. Churches publish what they issue —
ordination, certificates, ministry licences, affiliation and invitation
letters — and set their own titles, requirements and fees. Ministers apply,
work through what each church asks, and hold every signed document in a
Digital Minister Passport with a code anyone can check.

Monolithic MERN app: one repo, one Node process in production.

## Getting started

```bash
npm install            # server deps, then client deps via postinstall
cp .env.example .env   # set MONGO_URI if you are not on a local mongod
npm run seed           # demonstration catalogue, and sign-ins to reach the consoles
npm run dev            # Express :4000 + Vite :5173
```

Requires Node >= 20 and MongoDB. Seeding prints a platform-administrator and a
church-owner sign-in; both use the password `kingdom-demo-2026`, and neither is
created when `NODE_ENV=production`.

Payments run against a **local mock gateway** until Pesapal credentials are
configured, so the whole application and giving flow is testable with no
account anywhere.

## The one rule

**A credential is never issued on payment alone.** Every ordination, licence,
certificate and diploma has to carry a decision by the issuing church — a
review of the applicant, an interview, or both. The builder refuses to publish
one without it (`validateOfferingForPublish` in `server/lib/derive.js`), and the
workflow engine mints a credential only from an explicit decision
(`decide` in `server/lib/workflow.js`).

A fee is an **application fee**: it pays for the church to assess someone, it
confers nothing, and the church may still decline. That is stated on the
listing, in the application flow, and on the issued document.

Discount anchors, "% off" and merchandising badges are stripped from anything
that confers standing — at the schema level, not merely hidden in the view.

## The model

**Offering** — one thing a church issues. The church writes it: type, tier,
title, fee, and what it requires. Requirements compose: named courses, prior
credentials from *any* church, groups (`all` / `any` / `at least N` / *N credit
units*, which is how credits toward a larger award are expressed), a paper the
church wrote, an interview, documents, references, attestations, and structured
eligibility minimums.

**Application** — someone asking a church to credential them. Carries the
answers, the uploaded documents, the referees' responses, every assessment
attempt, the interview, the decision, and a timeline both sides read. Church
and applicant see the same checklist because both render from one evaluator
(`server/lib/requirements.js`).

**Credential** — what a person holds once a church has signed. Renders as a real
PDF (`server/lib/documents.js`) and carries a public verification code. Revoked
credentials verify *as revoked*, never as missing.

**Outcome** — the comparison bucket a listing sits in. Many churches compete in
each one, and the outcome page is where that happens.

## The consoles

`/manage/:churchSlug` — the church's own. Applicants queue and decision drawer,
the requirements builder, course and curriculum builder, assessment builder,
books, media library, interview availability, the public-page builder, giving,
finance and the team.

`/admin` — the platform's. Churches, the verification queue, people,
cross-church applications, payments, **settlements**, merchandising, settings
and the audit trail.

Authority over a church is a **relationship**, not a property of an account:
`ChurchMembership` carries the role (owner, admin, registrar, instructor,
finance, reviewer). One person can administer two ministries and be an
applicant at a third.

## Onboarding

Ten steps at `/onboarding`, each saved server-side so a church can leave and
come back. A church **publishes immediately** — nothing waits on us.
Verification is a badge a platform administrator grants after seeing
registration documents; it changes what visitors are told, not what a church
may do.

## Interviews

The platform hosts no video. A church publishes times it is free and pastes
whatever it already uses — Zoom, Meet, Teams, WhatsApp, a telephone number, an
address. The platform owns the diary, the reminders, the calendar file and the
record of what was decided.

## Money

Pesapal API 3.0, with a local mock when no credentials are set. Neither the
browser callback nor the IPN carries the payment status — both fetch it and
converge on one handler that claims the payment with a conditional update, so
the two racing each other cannot fulfil an order twice.

Pesapal has no split-payment facility, so everything lands in the platform account
and each church's balance is a ledger the platform keeps. A platform
administrator prepares a settlement, pays it out, and records it with a
transfer reference. Churches see their account line by line.

## Scripts

| Script | |
| --- | --- |
| `npm run dev` | Server and client together |
| `npm test` | Vitest. Two suites need a local mongod and skip themselves without one |
| `npm run migrate` | Apply pending migrations (also runs on boot) |
| `npm run seed` | Reseed the demonstration catalogue, leaving user data alone |
| `npm run seed:all` | Reseed and clear users, orders, enrolments, credentials, applications |
| `npm run build` | Build the client |
| `npm start` | Production: one Node process |
| `npm run lint` | Lint the client |

## Structure

```
server/
  models/        Church Offering Course Application Credential Assessment …
  controllers/   market · application · applicants · authoring · church ·
                 payment · admin · finance · donation · media · commerce …
  lib/
    requirements Evaluates what an applicant still owes a church
    workflow     The only thing that writes an application's status or mints a credential
    derive       Values computed from other values, including the ethics rule
    pesapal/     The live client, and the mock that stands in for it
    ledger       A church's running account, append-only
    storage/     Local disk behind a driver seam
  migrations/    Idempotent, applied on boot
  __tests__/     Vitest

client/src/
  pages/         Home Outcome Listing Apply Applications Passport Give …
  pages/manage/  The church console
  pages/admin/   The platform console
  components/admin/  Shell, and the table/dialog/drawer/form kit
  styles/        tokens · base · app · pages · admin
```

## Demonstration content

Everything seeded carries `demo: true`. **Seven of the twelve ministries are
real organisations named in `PRODUCT.md` as prospective partners; the listings,
fees, photography and issue counts attached to them are placeholder content
those ministries have not supplied.** A platform administrator can turn demo
mode off, which makes all of it unreachable rather than merely unlinked.

## Production

```bash
npm install && npm run build && npm start
```

One Express process serves `/api/*`, the built client, and falls back to
`index.html` for client routing. Set `PORT`, `MONGO_URI`, `JWT_SECRET`,
`PUBLIC_BASE_URL` and `UPLOAD_DIR`; the server refuses to start on a
placeholder secret. Uploads live on an attached disk at `UPLOAD_DIR`.
