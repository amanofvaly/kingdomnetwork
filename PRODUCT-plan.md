1. Books & materials — the entire feature

  Console → Books authors title, subtitle, author, cover, price, page count, and attached files. Server-side the whole chain works:
  market.listResources/resourceDetail, cart pricing, orders, entitlements, and download in /me/library. The user side simply doesn't
  exist:

  - No /resources or /resources/:slug route in App.jsx — GET /resources and GET /resources/:slug (public.js:27-28) have no caller.
  - Cards on the church page are plain <article>, not links (ChurchDetail.jsx:157).
  - market.search queries Offering only — resources never appear in search or suggest.
  - No nav or footer entry.
  - The only path that mentions a resource is cart cross-sell (Cart.jsx:42), which links to /resources/:slug → NotFound.

  A church can price and publish a book that literally no visitor can reach.

  2. Custom application questions

  Credentials.jsx:727 is a form builder — question, answer type, options, help text, required. The server honours it:
  application.controller.js:203 accepts answers keyed to it, and requirements.js:93-102 emits an "Application form — N questions from 
  the church" step.

  No user-facing screen ever asks them. Apply.jsx handles only attestations, fee and submit; Applications.jsx handles pay,
  info-request and document upload. Nothing anywhere sends answers. So:

  - The applicant sees a checklist item that stays pending forever, whose "Finish this" button (Applications.jsx:144) goes to
    /apply/:slug, where the questions aren't.
  - The console has a fully-built "Application answers" panel (Applicants.jsx:235-242) that can never render a row.

  3. Page builder

  PageBuilder.jsx offers 16 blocks with reorder and show/hide. ChurchDetail.jsx:64-65 reads sections only to build a visibility set:

  - order is ignored entirely — the church reorders, saves, and the preview iframe is identical.
  - Visibility applies to 5 types (donate, whatWeIssue, courses, resources, gallery); About, Story, Service times, Leadership and
    Contact render regardless of the toggle.
  - statementOfFaith, video, richText, cta render nowhere — and can't even be added: defaultSections omits them and there's no "add
    block" control, so the editors at PageBuilder.jsx:105 are unreachable.
  - page.accent is saved and never read.

  4. Posts

  Console → Posts writes to the church's followers' /me feed only. Nothing appears on the church's own public page — GET 
  /churches/:slug/posts (public.js:24) has no client consumer, and churchDetail doesn't return posts. A visitor who lands on the
  church page sees no sign the church posts at all.

  5. Coursework — assignments, live sessions, credits

  The lecture editor offers six kinds (Courses.jsx:16-23). Learn.jsx:108 renders exactly two shapes: quiz, and "everything else as
  paragraphs".

  - Assignment — "Assignment brief" and "Marking criteria, one per line" are authored into lecture.assignment.brief/rubric; the
    learner gets the generic paragraph renderer, so brief and rubric never appear. submissionTypes and dueDays never show. The
    Submission model (models/Submission.js) is imported by nothing — there is no way to hand anything in.
  - Live session — "When" and "Joining link" are authored (Courses.jsx:318-319); live-session is missing from KIND_ICON/KIND_LABEL
    (Learn.jsx:13-14), so the label renders undefined, and neither the time nor the link is displayed anywhere.
  - Credit units — authored, and setProgress even records creditUnitsEarned on the enrollment; zero occurrences in any user-facing
    file.
  - Preview — CourseDetail.jsx:36 shows a "Preview" badge on the row with nothing to open.

  6. Credential fields authored and never shown

  Zero occurrences anywhere outside /manage: intake (Opens / Closes / Places), fee.refundPolicy ("Refund policy"), creditValue
  ("Credit units"), curriculumOutline. A church can set an intake window with limited places and a refund policy; the applicant is
  shown none of it.

  7. Signatory — worse than invisible

  Settings says "Whose name appears on everything you issue." It's captured onto the credential at issuance (workflow.js:187). But
  documents.js:109 and :174 both sign with church?.leaders?.[0] — the first leader in the list, not the chosen signatory. So the
  certificate and invitation letter can name a different person than the one the church picked, and than the one
  passport.controller.js:195 shows on the passport screen. signatureMediaId exists on both models, has no upload control, and is never
  drawn.

  8. Smaller ones

  - Statement of faith — editable (Settings.jsx:77), offered as a page block, rendered nowhere.
  - WhatsApp and postal address — editable (Settings.jsx:97,103), never rendered publicly; only email and phone reach the page.
  - Interview instructions — "Instructions for the applicant" reaches the confirmation email and the .ics description, but
    availableSlots doesn't return it and InterviewBooking.jsx never shows it on screen.