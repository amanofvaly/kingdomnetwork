Kingdom Network — from demo marketplace to a real credentialing 
 platform

 Context

 The repo today is a working MERN monolith (Express 5 + Mongoose 8 +
 React 19/Vite, plain JS, no
 TypeScript) with a genuinely good read-path: 12 churches, 39
 offerings, 27 courses (778 lessons),
 faceted search, a requirement graph that stacks credentials across
 churches, live PDF document
 rendering, and a Digital Minister Passport with public verification.
 All of it is real code against
 a real database — what is fake is the seed catalogue and the payment 
 simulator.

 What does not exist at all:

 - No church-side console. User.role has 'church' and 'admin',
   requireChurch middleware
   is written — and nothing anywhere reads any of it. There is no
   listing editor, no course builder,
   no test builder, no applicant queue, no page manager, no payout
   screen.
 - No exit from in-review. Every credential a church is supposed to
   sign sits in that state
   forever; no code path issues or declines one. This is the single
   biggest hole.
 - No application entity. A Credential in in-progress/in-review is the
   application, with
   requirements encoded as string tokens ('course:foo',
   'credential:bar') parsed by .slice(7).
 - No file upload anywhere. No <input type="file"> exists in the
   codebase.
 - No real payments, no fees, no donations, no payouts, no ledger.
 - No platform admin.

 And one ethical problem in the current model: acquisition: 'instant'
 means pay → ordained, with
 compareAtPrice struck through and "Add to basket" on ordination cards.
 That reads as a store
 selling titles.

 This plan builds the real system: church onboarding and landing pages,
 a full church admin panel
 with authoring tools, an application/interview/approval workflow,
 Pesapal payments and donations
 with platform-admin settlement, a platform admin console, and an
 ethics pass on the language and
 rules. The existing site structure, design tokens and read-path stay.

 Decisions already made

 ┌─────────────┬───────────────────────────────────────────────────┐
 │             │                                                   │
 ├─────────────┼───────────────────────────────────────────────────┤
 │ Delivery    │ One plan, implemented straight through all phases │
 ├─────────────┼───────────────────────────────────────────────────┤
 │ Payments    │ Pesapal API 3.0 only; the 6-rail simulator is     │
 │             │ removed (a dev mock keeps local work possible)    │
 ├─────────────┼───────────────────────────────────────────────────┤
 │ Currency    │ USD everywhere — no FX, no per-church currency    │
 ├─────────────┼───────────────────────────────────────────────────┤
 │ Interviews  │ Provider-agnostic scheduling — church publishes   │
 │             │ slots and pastes any Zoom/Meet/Teams/phone link   │
 ├─────────────┼───────────────────────────────────────────────────┤
 │ Church      │ Page goes live immediately on publish; "Verified" │
 │ publishing  │  is a badge a platform admin grants               │
 ├─────────────┼───────────────────────────────────────────────────┤
 │             │ Credentials can never be issued on payment alone  │
 │ Ethics gate │ — every ordination/licence/certificate must carry │
 │             │  at least one church decision step                │
 ├─────────────┼───────────────────────────────────────────────────┤
 │ Commerce    │ Credentials use a dedicated /apply flow; the      │
 │ split       │ basket survives for courses, books and resources  │
 ├─────────────┼───────────────────────────────────────────────────┤
 │ Storage     │ Local disk, path from UPLOAD_DIR, behind a driver │
 │             │  seam (Render persistent disk in production)      │
 ├─────────────┼───────────────────────────────────────────────────┤
 │ Seed data   │ Demo catalogue stays, behind demo: true + a       │
 │             │ DEMO_MODE switch and an admin toggle              │
 └─────────────┴───────────────────────────────────────────────────┘

 Vocabulary (from how churches actually credential)

 Research confirms the real ladder is Certified → Licensed → Ordained
 (Assemblies of God,
 Wesleyan and others), that licences are typically annually renewable
 with continuing-education
 hours, that Bible institutes issue certificates, diplomas and credit
 units, and that
 letters of good standing / recommendation are distinct artifacts. The
 existing model already
 supports stacking; the plan adds tiers, renewal, credit units,
 references, attestations and
 interviews so the vocabulary a church actually uses is expressible
 without inventing new nouns.

 ---

 Architecture decisions

 1. Roles become multi-tenant

 User.role is platform-level only: 'member' | 'platform_admin'
 (migrated from
 learner|church|admin). Church-scoped authority moves to a new
 ChurchMembership — a person
 can administer two churches and still be an applicant at a third.

 Church roles: owner, admin, registrar (applications + issuance),
 instructor (courses +
 assessments), finance (payments + payouts), reviewer (interviews +
 decisions, read-only
 elsewhere).

 New middleware in server/middleware/auth.js beside the existing
 requireAuth/optionalAuth:
 requirePlatformAdmin, requireChurchRole(...roles) (resolves req.church
 +
 req.membership from :churchSlug). requireChurch is replaced.

 2. Application becomes a first-class entity

 Credential stops doubling as an application and becomes purely the
 issued artifact.

 Application {
   reference, userId, churchSlug, offeringSlug,
   status: draft | submitted | fee_pending | under_review |
 info_requested
         | coursework | assessment | interview | final_review
         | approved | issued | declined | withdrawn | expired,
   steps: [{ key, type, label, status, startedAt, completedAt,
 waivedBy, waiverReason, note }],
   answers: {},                                   // church-defined
 application form
   documents: [{ key, mediaId, status, note, reviewedBy, reviewedAt }],
   references: [{ name, email, phone, relationship, status, token,
 respondedAt, response }],
   attestations: [{ key, statement, agreedAt }],
   attempts: [assessmentAttemptId], interviewId, paymentRef,
 credentialId,
   decision: { by, at, outcome, reason, publicNote, internalNote },
   timeline: [{ at, actorId, actorRole, event, note, visibility:
 church|applicant|both }],
 }

 timeline is the tracking the applicant and the church both read; steps
 is the derived
 checklist. Existing in-progress/in-review credentials migrate into
 Applications.

 3. One requirement evaluator, one workflow engine

 Today the same requirement logic is written twice — inline in
 grantAccess()
 (server/controllers/checkout.controller.js) and again in settle()
 (server/controllers/passport.controller.js). Both are replaced by:

 - server/lib/requirements.js — a pure evaluate(offering, context)
   returning typed steps
   ({ type: 'course'|'credential'|'assessment'|'interview'|'document'|'
   reference'|'attestation'|'fee'|'review', status, ... }).
   It also resolves the new requirement groups (all / any / atLeast N
   over a set), which is
   how "credits in a degree" is expressed.
 - server/lib/workflow.js — advances an Application through its states,
   called on every
   event (fee paid, course completed, assessment passed, document
   uploaded, interview outcome,
   church decision). It is the only thing that writes
   Application.status and the only thing that
   mints a Credential.

 Both are pure and reused by the applicant dashboard, the church queue,
 and the public listing page.

 4. Structural fixes the admin panel forces

 These are latent bugs that only bite once churches can edit data. Fix
 them as part of the
 foundation, not after.

 Problem: Slugs are the universal FK (requires.credentials:
 ['ordained-minister-rock', ...]) with zero integrity. A church
 renaming a slug shatters the cross-church requirement graph.
 Fix: Slugs become immutable after first publish. Editing a title never

 changes the slug. Deleting/unpublishing an offering runs a dependency
  check ("3 offerings at 2 churches require this") and blocks or
 warns. Store slugHistory[]. New relations carry ObjectId refs
 alongside the slug.
 ────────────────────────────────────────
 Problem: Lecture progress keys are
 slugify(section.title)/slugify(lecture.title) — renaming a lesson
 silently orphans every learner's progress.
 Fix: Lectures and sections get stable generated ids at authoring time.

 Migration rewrites existing completedLectures[] keys.
 ────────────────────────────────────────
 Problem: Offering.acquisition and Course.totalMinutes/lectureCount/...

 are derived only at seed time by modeOf() and finalise().
 Fix: Move both into server/lib/derive.js, called from model
 pre('save')
 hooks and reused by the seed script.
 ────────────────────────────────────────
 Problem: Assessment passes are stored as a string stuffed into
 Credential.notes ('assessment:passed score:85').
 Fix: Real AssessmentAttempt records.
 ────────────────────────────────────────
 Problem: paperFor() caps every paper at 10 questions while offerings
 declare 25–60.
 Fix: Church-authored assessments with real banks and a drawCount that
 is validated against pool size.
 ────────────────────────────────────────
 Problem: Three text indexes are declared and never used — search is
 regex $or.
 Fix: Keep regex for now (correct for prefix/typeahead) but drop the
 dead text indexes, or wire $text for the full-search path. Decide
 during Phase 1; do not leave both.
 ────────────────────────────────────────
 Problem: Church.leaders[] duplicates Instructor records for the same
 people.
 Fix: Instructor gains an optional userId and Church.leaders[] gains an

 optional instructorSlug, so one person is edited once.

 ---

 Data model

 Modified

 server/models/User.js — role: ['member','platform_admin']; add status:
 active|suspended,
 emailVerifiedAt, passwordResetToken/ExpiresAt, timezone,
 notificationPrefs{},
 ministry: { yearsInMinistry, currentRole, congregation, denomination,
 priorCredentials[] },
 lastLoginAt. Keep churchSlug as a nullable convenience;
 ChurchMembership is the source of truth.

 server/models/Church.js — add:
 status: draft|published|suspended, publishedAt, ownerId, timezone,
 currency (fixed 'USD'),
 denomination, tradition, legal: { registeredName, registrationNumber,
 registrationCountry, taxId },
 contact: { email, phone, whatsapp, addressLines[], mapUrl, socials{}
 },
 serviceTimes: [{ day, time, label, format }],
 verification: { tier, state: unverified|pending|verified|rejected,
 documents[], submittedAt, reviewedBy, reviewedAt, notes }
 (verified: Boolean is kept as a derived mirror so no read-path code
 breaks),
 onboarding: { currentStep, completedSteps[], startedAt, completedAt },
 page: { accent, sections: [{ id, type, order, visible, data }] },
 donations: { enabled, headline, blurb, causes: [{ id, title, blurb,
 mediaId, goalAmount, raisedAmount, active }], suggestedAmounts[],
 allowCustom, minAmount, allowAnonymous, thankYouMessage,
 showRecentGifts },
 payout: { method: mpesa|mobile-money|bank, accountName,
 accountRefMasked, accountRefEncrypted, bankName, branch, swift,
 country, confirmedAt },
 commissionPercentOverride, signatory: { name, title, signatureMediaId
 }.

 server/models/Offering.js — type enum gains 'letter-of-standing' and
 'diploma'.
 requires gains:
 interview:   { required, durationMinutes, panelSize, instructions,
 whatIsAssessed[] }
 documents:   [{ key, label, description, required, acceptedTypes[],
 maxMb }]
 references:  [{ key, label, required, relationship }]
 attestations:[{ key, statement, required }]
 credentialGroups: [{ label, mode: all|any|atLeast, count,
 offeringSlugs[] }]
 courseGroups:     [{ label, mode: all|any|atLeast, count,
 courseSlugs[], creditUnits }]
 minMonthsInMinistry, minAge
 Plus on the offering itself: assessmentSlug (→ the church's own
 Assessment),
 applicationForm: [{ key, label, type, options[], required, help }],
 fee: { amount, currency, label, refundable, refundPolicy,
 renewalAmount },
 renewal: { required, everyMonths, continuingEducationHours, graceDays
 },
 creditValue, tier (certified|licensed|ordained|diploma|other),
 curriculumOutline: [{ stage, label, description, courseSlugs[],
 creditUnits }],
 capacity, intake: { mode: rolling|windows, windows: [{ opensAt,
 closesAt, seats }] },
 status: draft|published|archived, publishedAt, slugHistory[],
 disclosure (required church-authored statement of what the credential
 does and does not confer).
 acquisition stays (derived) but gains 'application' and can no longer
 be 'instant' for
 credential types — enforced in derive.js and at publish time.

 server/models/Course.js — stable section.key / lecture.key;
 lecture.mediaId;
 lecture.kind gains 'live-session'; status: draft|published|archived;
 version;
 assignment: { brief, rubric[], submissionTypes[], dueDays } on
 assignment lectures;
 creditUnits; authoredBy; keep demo.

 server/models/Credential.js — add applicationId, issuedBy (user),
 signatory{},
 renewal: { dueAt, lastRenewedAt, renewalCount }, revocation: { by, at,
 reason, publicReason },
 documentMediaId (the rendered PDF, cached). Drop the outstanding[]
 token array and the
 notes-as-assessment-store hack (both move to Application). Keep
 pathwaySlug out of new writes.

 server/models/Enrollment.js — kind gains 'resource'; add resourceSlug,
 applicationId,
 creditUnitsEarned, certificateIssuedAt.

 server/models/Order.js — payment block replaced by a paymentRef
 pointing at the new
 Payment; items[].kind gains 'resource'; the 6-method enum and
 simulated flag are removed.

 New models (server/models/)

 Model: ChurchMembership.js
 Purpose: user ↔ church ↔ role, with invite tokens and status
 ────────────────────────────────────────
 Model: MediaAsset.js
 Purpose: { churchSlug, uploadedBy, kind, filename, storageKey,
 mimeType, bytes, width, height, durationSeconds, title, alt,  tags[],
  folder, visibility: public|private, usage: [{entity,  id}], checksum
  }
 ────────────────────────────────────────
 Model: Assessment.js
 Purpose: church-authored test: questions, passMark, durationMinutes,
 attemptsAllowed, drawCount, shuffle flags, showAnswers, status
 ────────────────────────────────────────
 Model: AssessmentAttempt.js
 Purpose: { userId, applicationId, assessmentSlug, questionsServed[],
 answers[], autoScore, manualScore, score, passed,  attemptNumber,
 startedAt, submittedAt, gradedBy, gradedAt,  feedback }
 ────────────────────────────────────────
 Model: Application.js
 Purpose: the workflow object above
 ────────────────────────────────────────
 Model: Interview.js
 Purpose: { applicationId, churchSlug, userId, slotId, scheduledFor,
 timezone, durationMinutes, provider, joinUrl, dialIn,  location,
 panel[], status, outcome, score, notes,  remindersSent[],
 rescheduleCount }
 ────────────────────────────────────────
 Model: InterviewSlot.js
 Purpose: church availability: { churchSlug, startsAt, endsAt,
 capacity,
  bookedCount, panel[], provider, joinUrl, status }
 ────────────────────────────────────────
 Model: Submission.js
 Purpose: assignment submissions with rubric grading
 ────────────────────────────────────────
 Model: Resource.js
 Purpose: books / audio / study guides: { churchSlug, slug, title,
 kind,
  mediaIds[], previewMediaId, price, cover, status, demo }
 ────────────────────────────────────────
 Model: Payment.js
 Purpose: see Pesapal section
 ────────────────────────────────────────
 Model: LedgerEntry.js
 Purpose: { churchSlug, type: credit|fee|debit|settlement, amount,
 balanceAfter, paymentRef, settlementRef, description, at }
 ────────────────────────────────────────
 Model: Settlement.js
 Purpose: { reference, churchSlug, periodStart, periodEnd,
 paymentRefs[], gross, platformFee, net, status, method,  externalRef,
  evidenceMediaId, markedBy, paidAt, notes }
 ────────────────────────────────────────
 Model: PlatformSettings.js
 Purpose: singleton: commissionPercent, pesapalIpnId, demoMode,
 homeSlots[], outcomes[], disclosure copy, feature flags
 ────────────────────────────────────────
 Model: AuditLog.js
 Purpose: { actorId, actorRole, churchSlug, action, entity, entityId,
 before, after, ip, at }
 ────────────────────────────────────────
 Model: Notification.js
 Purpose: in-app notifications + email outbox status

 Migrations

 There is no migration tooling. Add a tiny idempotent runner:
 server/migrations/NNN-*.js files with
 { id, up(db) }, a Migration collection recording applied ids, run via
 npm run migrate and
 automatically on boot in development. First migrations: role rename,
 stable lecture keys,
 credential → application split, derived-field backfill, demo flag
 normalisation.

 ---

 Pesapal integration

 Verified against the API 3.0 docs. Base URLs: sandbox
 https://cybqa.pesapal.com/pesapalv3,
 live https://pay.pesapal.com/v3.

 server/lib/pesapal/client.js
 - RequestToken → POST /api/Auth/RequestToken {consumer_key,
   consumer_secret} → {token, expiryDate}.
   Token is valid 5 minutes — cache in memory, refresh at 4:00, never
   persist.
 - RegisterIPN → POST /api/URLSetup/RegisterIPN {url,
   ipn_notification_type:'GET'} → {ipn_id}.
   Called once on boot if PlatformSettings.pesapalIpnId is empty or the
   URL changed; the id is stored.
 - SubmitOrderRequest → POST /api/Transactions/SubmitOrderRequest with
   {id, currency:'USD', amount, description, callback_url,
   cancellation_url, notification_id, billing_address:{email_address,
   phone_number, first_name, last_name, country_code}}
   → {order_tracking_id, merchant_reference, redirect_url}.
   id = our Payment.reference, ≤50 chars, [A-Za-z0-9-_.:] only.
   description ≤100 chars.
 - GetTransactionStatus → GET
   /api/Transactions/GetTransactionStatus?orderTrackingId= →
   {status_code, payment_status_description, confirmation_code,
   payment_method, amount, ...}.
   status_code: 0 INVALID · 1 COMPLETED · 2 FAILED · 3 REVERSED.
 - RefundRequest and CancelOrder for admin-initiated reversals.

 Critical: the callback and the IPN carry no payment status — status
 must always be fetched
 with GetTransactionStatus. Both paths converge on one idempotent
 applyPaymentResult(payment, status) guarded by Payment.status so the
 IPN/callback race cannot
 double-issue a credential or double-credit a ledger.

 Routes (server/routes/payments.js)
 POST /api/payments/intent        create Payment, SubmitOrderRequest,
 return redirect_url
 GET  /api/payments/ipn           Pesapal GET (OrderTrackingId,
 OrderMerchantReference,
                                  OrderNotificationType) → fetch status
 → apply → respond with the
                                  JSON echo Pesapal expects:
 {orderNotificationType,
                                  orderTrackingId,
 orderMerchantReference, status: 200}
 GET  /api/payments/callback      browser return → fetch status → apply
 → redirect into the app
 POST /api/payments/:ref/refresh  manual re-poll (support tool)

 Payment model
 Payment {
   reference, kind: application_fee | renewal_fee | course | resource |
 donation,
   userId?, churchSlug, applicationId?, orderRef?, donation?: {
 causeId, message, anonymous, displayName },
   amount, currency:'USD', platformFee, netToChurch,
   status: created|pending|completed|failed|reversed|refunded,
   pesapal: { orderTrackingId, merchantReference, redirectUrl,
 confirmationCode,
              paymentMethod, statusCode, statusDescription,
 lastCheckedAt },
   payer: { name, email, phone, country }, ipnEvents: [{ at, raw }],
 settlementRef
 }

 Commission and settlement. Pesapal has no marketplace split, so
 everything lands in the platform
 account. On completed, platformFee = round(amount * commissionPercent)
 and netToChurch are
 computed and two LedgerEntry rows written (credit + fee). Churches see
 a running balance. A
 platform admin builds a Settlement for a church over a period, pays
 out off-platform, and marks it
 paid with a reference and an uploaded evidence file; the covered
 payments are stamped and the ledger
 debited. Exactly the manual flow described.

 Dev mock. With no credentials configured, server/lib/pesapal/mock.js
 serves a local pay-page
 that mimics the redirect, then calls our own IPN. Local development
 never needs Pesapal keys; the
 old 6-rail simulator UI and server/data/payment-methods.js are
 deleted.

 New env (add to .env.example):
 PESAPAL_ENV=sandbox|live, PESAPAL_CONSUMER_KEY,
 PESAPAL_CONSUMER_SECRET, PUBLIC_BASE_URL,
 UPLOAD_DIR=./server/uploads, PLATFORM_COMMISSION_PERCENT=10,
 DEMO_MODE=true,
 RESEND_API_KEY (optional), MAIL_FROM.

 ---

 Server structure

 server/routes/index.js currently holds every route in 60 lines. Split
 (index.js keeps the mounts):

 server/routes/
   public.js      home, outcomes, search, listings, churches, courses,
 resources, verify, donate
   account.js     auth, profile, notifications, password reset
   apply.js       applications, documents, references, assessments,
 interviews (applicant side)
   commerce.js    cart, orders, checkout (courses + resources only)
   payments.js    intent, ipn, callback, refresh
   manage.js      /api/manage/:churchSlug/*   — the church console
   admin.js       /api/admin/*                — the platform console

 New libs: server/lib/requirements.js, workflow.js, derive.js, storage/
 (driver interface +
 local.js, seam for s3.js), pesapal/, mailer/ (console.js + resend.js),
 ledger.js,
 ics.js, audit.js, disclosures.js, slugs.js, upload.js (multer + mime
 sniffing + limits).

 New controllers: church.controller.js (onboarding + page),
 media.controller.js,
 authoring.controller.js (offerings/courses/assessments/resources),
 application.controller.js, interview.controller.js,
 donation.controller.js,
 finance.controller.js, admin.controller.js,
 notification.controller.js.

 ---

 Client structure

 The client has no modal, no toast, no data table, no file input, no
 form abstraction — three
 component files plus a layout. Build a small admin kit first, in the
 existing idiom (named exports,
 arrow components, relative imports with extensions, CSS classes over
 props).

 client/src/components/admin/ — Shell.jsx (sidebar + topbar + church
 switcher),
 DataTable.jsx (sort, filter, paginate, bulk select, empty state),
 Dialog.jsx (native <dialog>,
 focus trap, Escape), Drawer.jsx, Toast.jsx + ToastProvider, Form.jsx
 (Field/Input/Select/Textarea/Checkbox/RadioGroup/DateTime/Money),
 FileDrop.jsx,
 MediaPicker.jsx, ParagraphEditor.jsx, Stepper.jsx, StatusPill.jsx,
 Confirm.jsx,
 RepeatableList.jsx (add/remove/reorder — the workhorse for
 requirements, questions, sections).

 Rich text: all long-form content in this codebase is already string[]
 rendered as <p> in
 .prose. ParagraphEditor (a textarea per paragraph with
 add/remove/reorder) matches that exactly
 and avoids adding a WYSIWYG dependency and an HTML-sanitisation
 surface. No rich-text library.

 client/src/styles/admin.css — a fifth stylesheet using the existing
 tokens. Note the tokens
 named --green-* hold blue values (#3157a4); DESIGN.md and
 .impeccable/design.json both
 describe palettes the code no longer uses. Do not "fix" the names as
 part of this work — match what
 tokens.css actually holds, and add a one-line note to DESIGN.md.

 Client libs: lib/api.js gains put and del and an upload() helper
 (multipart, progress).
 New lib/toast.jsx, lib/church.jsx (active-church context for /manage),
 lib/permissions.js.

 Routes

 /for-churches                     replaces /teach — real CTA into
 onboarding
 /onboarding/*                     the stepwise church onboarding
 wizard (resumable)

 /manage/:churchSlug               church console (ChurchShell + role
 gate)
   /overview        queue, upcoming interviews, revenue, page health
   /applicants      the table + detail drawer + decision panel
   /credentials     offerings list + the requirements builder
   /courses         course list + curriculum builder
   /assessments     test builder + question bank
   /resources       books and materials
   /media           media library
   /interviews      availability slots, bookings, outcomes
   /issued          issued credentials, renewals, revocation
   /page            landing-page builder + preview
   /donations       causes, incoming gifts, thank-you settings
   /finance         balance, payments, platform fee, settlements,
 payout details
   /people          staff invites and roles
   /settings        profile, verification, documents

 /admin                            platform console (AdminShell +
 platform_admin gate)
   /overview /churches /verification /users /offerings /applications
   /payments /settlements /donations /merchandising /taxonomy /audit
 /settings

 /apply/:offeringSlug              the application flow (replaces
 basket for credentials)
 /applications                     applicant's applications
 /applications/:reference          tracking: timeline, next action,
 documents, interview
 /interviews/:id                   join / reschedule
 /give/:churchSlug                 dedicated donation page
 /churches/:slug                   public church page, now rendered
 from church-managed sections

 /cart and /checkout survive for courses and resources only, and now
 redirect to Pesapal.

 ---

 Church onboarding (stepwise, resumable)

 Every step saves server-side (PATCH
 /api/manage/:slug/onboarding/:step) so a church can leave and
 come back. A progress rail shows all ten. Steps 6–9 are skippable.

 1. You and your church — name, email, password, your role. Creates
    User + draft Church + owner membership.
 2. Church identity — display name, registered name, short name,
    denomination/tradition, founded year, languages, tagline.
 3. Location and contact — country, city, address, timezone, email,
    phone/WhatsApp, website, socials.
 4. Leadership — leaders with photo upload, title, bio. One is marked
    the signatory whose name and signature appear on issued documents.
 5. Story and imagery — about, story paragraphs, logo, cover image,
    gallery, service times.
 6. What you issue — pick outcome types; seeds matching draft offerings
    to fill in later.
 7. Donations — enable, causes, suggested amounts, message.
 8. Payouts — method and account details (required before a settlement
    can be made).
 9. Verification — upload registration and fellowship documents →
    queues for platform review. Skippable; the badge simply stays off.
 10. Preview and publish — see the public page as visitors will, then
     publish. Live immediately.

 ---

 The requirements builder (the heart of the church panel)

 One screen where a church composes what a credential demands. Each
 requirement is a card in a
 reorderable list; the preview pane renders the applicant-facing
 checklist live.

 Available requirement types:
 - Coursework — pick courses; groups support all of / any N of / at
   least N credit units.
 - Prior credentials — pick offerings from any church (search across
   the marketplace), with the same group modes. This is how "credits
   toward a degree" works: any 3 of these 6 certificates.
 - Assessment — pick one of the church's own tests; set attempts and
   pass mark.
 - Interview — toggle on, set duration, panel size, what is assessed,
   instructions.
 - Documents — a checklist the applicant uploads (ministry record, ID,
   ordination certificate…).
 - References — named referees who receive an emailed form.
 - Attestations — statements the applicant must agree to (doctrinal
   statement, code of conduct, safeguarding).
 - Eligibility — free-text conditions, plus structured minimums (years
   in ministry, age).
 - Church review — final human decision, with turnaround days.

 Below that: the award (title, post-nominal, document title and body,
 validity months,
 renewability, continuing-education hours), the fee (amount, label,
 refund policy), intake
 (rolling or windows, seats), and the disclosure — a required,
 church-authored statement of what
 the credential does and does not confer.

 Publish validation blocks: a credential-type offering with no review
 and no interview; an
 assessment requirement with no assessment selected; a credential
 requirement that would create a
 cycle; a fee with no refund policy; a missing disclosure; an
 invitation letter without a
 destination.

 ---

 The application workflow

 Applicant — /apply/:offeringSlug: requirements review → application
 form → attestations →
 document uploads → referee details → pay the application fee via
 Pesapal → submitted. The fee is
 labelled "application fee" throughout and the confirmation states
 plainly that payment starts a
 process and confers nothing.

 Then /applications/:reference tracks it: an ordered step list with
 live status, the next action as
 a button, a visible timeline, and any "information requested" message
 from the church.

 Church — /manage/:slug/applicants: a filterable table (offering,
 status, date, waiting-on) with
 a detail drawer showing the applicant's profile and ministry history,
 every answer, every uploaded
 document (viewable inline), assessment attempts with per-question
 breakdown, reference responses,
 interview record and panel notes, and the full timeline. Actions:
 accept/reject individual
 documents, request more information, waive a requirement (with a
 recorded reason), schedule
 or record an interview, and the decision panel — Approve and issue /
 Decline (reason,
 applicant-visible note) / Defer.

 Approval runs workflow.issue(): mints the Credential, renders and
 caches the PDF via the
 existing server/lib/documents.js, stamps the signatory, emits the
 notification, and writes the
 audit entry.

 Interviews — the church publishes slots (date, time, duration,
 capacity, panel, and a meeting
 link it pastes: Zoom, Google Meet, Teams, WhatsApp, phone or in-person
 address). The applicant books
 one; both sides get an email with an .ics attachment (generated in
 server/lib/ics.js, no
 dependency). Reminders at T-24h and T-1h from an in-process sweep.
 Afterwards the panel records
 outcome, score and notes, which feeds the workflow.

 ---

 Church landing page and donations

 Church.page.sections is an ordered, toggleable list the church edits
 in /manage/:slug/page, with
 a live preview. Section types: hero, about, story, leadership,
 serviceTimes, gallery,
 video, statementOfFaith, richText, cta, contact, donate, plus
 auto-curated sections
 that pull live data and cannot go stale — whatWeIssue, courses,
 resources, faculty,
 credentialsIssued. The public /churches/:slug renders from this; the
 existing hand-built layout
 becomes the default section set, so nothing regresses for the seeded
 churches.

 Donations render as a section on the page and as a dedicated
 /give/:churchSlug. Causes with
 optional goals, suggested amounts, custom amount, optional anonymity,
 a message field, and a
 gift-aid-style note about the platform fee. Anonymous giving is
 allowed (Pesapal needs only an email
 or phone). Receipts are emailed. Churches see every gift and donor
 message in
 /manage/:slug/donations; platform admins see all gifts across all
 churches and settle them.

 ---

 Ethics pass

 Concrete, enforced changes — not copy suggestions:

 - No instant credentials. Enforced in derive.js and at publish
   validation.
 - Language split by type. Credentials: "Apply", "Application fee",
   "Requirements", "Issued by".
   Courses/resources keep "Enrol", "Add to basket", price.
   compareAtPrice, % off, badge and the
   bestseller flag are removed from credential types entirely
   (schema-level, not just CSS).
 - Delete the .offer-instant neon variant (pages.css:617-667) and the
   duplicated
   isImmediate() predicate in Home.jsx and market.jsx.
 - Required disclosure block on every credential listing and every
   issued PDF: who issues it, on
   whose authority, what it does and does not confer, that civil
   recognition varies by jurisdiction,
   and — for letters — that an invitation letter is a supporting
   document and does not guarantee a
   visa (server/lib/disclosures.js, rendered in both the page and the
   document).
 - Refund and withdrawal policy shown before payment, stored per
   offering.
 - Replace the baked-JPG hero.
   client/src/assets/hero-featured-henry.jpg with two invisible
   percentage-positioned hotspot buttons is unmaintainable and
   hard-codes an offer, price and church
   into a raster image. It becomes real markup driven by admin-managed
   PlatformSettings.homeSlots.
 - Demo content is labelled. DEMO_MODE + a platform-admin toggle hides
   all demo: true
   records; every demo card carries a visible "demonstration content"
   marker while it is shown. The
   seven real ministries' fabricated prices and stats stay out of any
   production view.

 ---

 Security and operations

 - env.jwtSecret currently falls back silently to
   'change-me-in-production' — fail fast in production. Same for
   PESAPAL_* when PESAPAL_ENV=live.
 - Rate limiting on /auth/*, /payments/*, reference-response and
   verification endpoints.
 - Upload validation: extension allowlist, real MIME sniffing (not the
   client's header), per-kind size caps, filename sanitisation, images
   re-encoded, no executables. Applicant documents are private — served
   through an authorised route, never from static.
 - Payout account numbers stored encrypted; only last-4 displayed.
 - helmet currently runs with contentSecurityPolicy: false — turn a
   real CSP on once upload origins are known.
 - Password reset and email verification flows (missing entirely
   today).
 - AuditLog on every issuance, revocation, waiver, decision,
   settlement, role change and verification action.
 - .env/.env.example are byte-identical and the live .env still holds
   the placeholder secret — call that out during Phase 1.

 ---

 Phases

 Implemented straight through, but in this order, each leaving the app
 runnable.

 #: 1
 Phase: Foundations
 Delivers: Migration runner; role/membership model; new middleware;
 route-file split; derive.js, requirements.js, slugs.js; storage
 driver + upload; admin UI kit + admin.css; security hardening; stable
  lecture keys
 ────────────────────────────────────────
 #: 2
 Phase: Onboarding & church page
 Delivers: The 10-step wizard; media library; page builder; public page

 rendered from sections; /for-churches
 ────────────────────────────────────────
 #: 3
 Phase: Authoring
 Delivers: Requirements builder; assessment builder + attempts;
 course/curriculum builder; resources; publish validation
 ────────────────────────────────────────
 #: 4
 Phase: Applications & interviews
 Delivers: Application + workflow.js; /apply flow; applicant tracking;
 church applicant queue and decisions; issuance; interview slots,
 booking, ICS, reminders, outcomes
 ────────────────────────────────────────
 #: 5
 Phase: Payments
 Delivers: Pesapal client, intent/IPN/callback, dev mock; application
 fees; course/resource checkout; donations; ledger; church finance
 screens; settlements
 ────────────────────────────────────────
 #: 6
 Phase: Platform admin
 Delivers: Every /admin surface; verification queue; merchandising
 slots
 + real hero; notifications and email; ethics/copy pass; demo-mode
 split
 ────────────────────────────────────────
 #: 7
 Phase: Verification
 Delivers: Seed rework, end-to-end script, docs

 ---

 Verification

 No test framework exists in this repo. Add Vitest (already a natural
 fit with Vite) with a
 mongodb-memory-server harness, and cover the parts where a bug is
 expensive:

 - requirements.evaluate() — group modes (all/any/atLeast),
   cross-church stacking, cycle detection.
 - workflow — every state transition, including waivers and the decline
   path.
 - applyPaymentResult() — idempotency under the IPN/callback race, and
   each Pesapal status_code.
 - ledger + settlement arithmetic — fee rounding, no double-credit.
 - derive.js — acquisition mode, course tallies, and the "no instant
   credential" rule.
 - Slug immutability and dependency checks.

 End-to-end walkthrough (npm run dev, Mongo running, PESAPAL_ENV unset
 so the mock runs):

 1. Sign up as a church at /for-churches → complete all ten onboarding
    steps, uploading a logo, cover, and two leader photos → publish →
    confirm /churches/:slug renders the managed sections.
 2. In /manage/:slug: upload media, build a 2-section course, build a
    15-question assessment, then build an Ordained Minister offering
    requiring that course, a prior certificate from another church, the
    assessment, two documents, one reference, an attestation, an
    interview, and church review. Confirm publish is blocked when
    review and interview are both off.
 3. Publish interview availability for next week.
 4. As a second (applicant) account: open the listing, confirm
    requirements render with the unmet prior credential linked and
    priced, apply, upload documents, agree to the attestation, name a
    referee, and pay the application fee through the mock gateway.
 5. Confirm the application appears in the church queue; complete the
    course and pass the assessment as the applicant; watch the steps
    tick over on /applications/:reference.
 6. As the church: accept the documents, waive the reference with a
    reason, book/confirm the interview, record a pass, then Approve and
    issue.
 7. As the applicant: see the credential in /passport, download the
    PDF, and verify the code at /verify/:code in a signed-out browser.
 8. Make a donation at /give/:churchSlug through the mock gateway;
    confirm it appears in the church's donations list and the ledger
    balance.
 9. As platform admin at /admin: grant the verification badge, build a
    settlement for the church covering the fee and the donation, mark
    it paid with a reference and evidence file, and confirm the
    church's balance drops to zero and the ledger reconciles.
 10. Run npm run lint and npm test, then npm run build && npm start and
     repeat steps 4–9 against the production build to confirm SPA
     fallback, static uploads and immutable asset caching still hold.

 Also confirm on a live Pesapal sandbox once credentials exist:
 RegisterIPN runs once and stores
 the id, a real SubmitOrderRequest redirects, the IPN fires, and
 GetTransactionStatus drives the
 final state — never the callback alone.
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
