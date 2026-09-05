import { offeringForApplication } from '../lib/applicationTerms.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { forCandidate, grade, servePaper } from '../lib/grading.js';
import { advance } from '../lib/workflow.js';
import { Application } from '../models/Application.js';
import { Assessment } from '../models/Assessment.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';

/**
 * Sitting the paper a church wrote.
 *
 * An attempt is a record: what was asked, what was answered, when, and how it
 * was marked. The previous system stored a pass by writing a string into the
 * credential's notes field, which meant a church could never see how anyone had
 * actually done.
 */

const load = async (req) => {
  const application = await Application.findOne({ reference: req.params.reference, userId: req.user._id });
  if (!application) return { error: { status: 404, message: 'That application was not found.' } };

  const offering = await offeringForApplication(application);
  if (!offering?.requires?.assessment?.required) {
    return { error: { status: 400, message: 'This application does not carry an assessment.' } };
  }

  const assessment = offering.assessmentSlug
    ? await Assessment.findOne({ slug: offering.assessmentSlug, status: 'published' })
    : null;
  if (!assessment) {
    return { error: { status: 409, message: 'The church has not published the paper for this yet.' } };
  }

  return { application, offering, assessment };
};

const attemptsAllowed = (assessment, offering) =>
  offering.requires?.assessment?.attemptsAllowed ?? assessment.attemptsAllowed ?? 3;

const passMarkFor = (assessment, offering) =>
  offering.requires?.assessment?.passMark ?? assessment.passMark ?? 70;

/** Start a sitting, or resume one already in progress. */
export const getPaper = asyncHandler(async (req, res) => {
  const { error, application, offering, assessment } = await load(req);
  if (error) return res.status(error.status).json({ success: false, message: error.message });

  const attempts = await AssessmentAttempt.find({ userId: req.user._id, applicationId: application._id, assessmentSlug: assessment.slug }).sort({ attemptNumber: -1 });
  const passed = attempts.find((a) => a.passed);
  const limit = attemptsAllowed(assessment, offering);

  if (passed) {
    return res.json({
      success: true,
      data: { passed: true, score: passed.score, submittedAt: passed.submittedAt, attemptsUsed: attempts.length, attemptsAllowed: limit },
    });
  }

  const live = attempts.find((a) => a.status === 'in-progress');
  if (live) {
    return res.json({
      success: true,
      data: {
        attemptId: live._id,
        attemptNumber: live.attemptNumber,
        attemptsUsed: attempts.length,
        attemptsAllowed: limit,
        title: assessment.title,
        instructions: assessment.instructions,
        passMark: live.passMark,
        dueAt: live.dueAt,
        questions: forCandidate(live.served),
      },
    });
  }

  const spent = attempts.filter((a) => a.status !== 'in-progress').length;
  if (spent >= limit) {
    return res.status(409).json({
      success: false,
      message: `You have used all ${limit} attempts. The church can allow another.`,
    });
  }

  const minutes = offering.requires?.assessment?.minutes ?? assessment.durationMinutes ?? 30;
  const served = servePaper(assessment);

  const attempt = await AssessmentAttempt.create({
    userId: req.user._id,
    applicationId: application._id,
    assessmentSlug: assessment.slug,
    churchSlug: assessment.churchSlug,
    attemptNumber: spent + 1,
    served,
    passMark: passMarkFor(assessment, offering),
    dueAt: new Date(Date.now() + minutes * 60 * 1000),
    status: 'in-progress',
  });

  application.attemptIds.push(attempt._id);
  application.log({ event: 'assessment:started', note: `Attempt ${attempt.attemptNumber}`, actorId: req.user._id, actorRole: 'applicant' });
  await application.save();

  res.json({
    success: true,
    data: {
      attemptId: attempt._id,
      attemptNumber: attempt.attemptNumber,
      attemptsUsed: spent,
      attemptsAllowed: limit,
      title: assessment.title,
      instructions: assessment.instructions,
      passMark: attempt.passMark,
      minutes,
      dueAt: attempt.dueAt,
      questions: forCandidate(served),
    },
  });
});

export const submitPaper = asyncHandler(async (req, res) => {
  const { error, application, offering, assessment } = await load(req);
  if (error) return res.status(error.status).json({ success: false, message: error.message });

  const attempt = await AssessmentAttempt.findOne({
    userId: req.user._id,
    applicationId: application._id,
    assessmentSlug: assessment.slug,
    status: 'in-progress',
  }).sort({ attemptNumber: -1 });

  if (!attempt) return res.status(409).json({ success: false, message: 'There is no sitting in progress.' });

  const responses = Array.isArray(req.body?.responses) ? req.body.responses : [];
  const result = grade(attempt.served, responses);

  attempt.responses = result.marked;
  attempt.autoScore = result.autoScore;
  attempt.submittedAt = new Date();

  // An overrun is recorded rather than voided: the church decides what a late
  // submission is worth, and losing someone's answers helps nobody.
  if (attempt.dueAt && attempt.submittedAt > attempt.dueAt) {
    attempt.feedback = 'Submitted after the time allowed.';
  }

  if (result.needsGrading) {
    attempt.status = 'awaiting-grading';
    attempt.score = undefined;
    attempt.passed = false;
    await attempt.save();

    application.log({ event: 'assessment:submitted', note: 'Awaiting grading', actorId: req.user._id, actorRole: 'applicant' });
    await advance(application, { offering });

    return res.json({
      success: true,
      data: { awaitingGrading: true, autoScore: result.autoScore, passMark: attempt.passMark },
    });
  }

  attempt.score = result.autoScore;
  attempt.passed = result.autoScore >= attempt.passMark;
  attempt.status = 'graded';
  attempt.gradedAt = new Date();
  await attempt.save();

  application.log({
    event: attempt.passed ? 'assessment:passed' : 'assessment:failed',
    note: `${attempt.score}% (pass mark ${attempt.passMark}%)`,
    actorId: req.user._id,
    actorRole: 'applicant',
    visibility: 'both',
  });
  await advance(application, { offering });

  const showAnswers =
    assessment.showAnswers === 'after-each' || (assessment.showAnswers === 'after-pass' && attempt.passed);

  res.json({
    success: true,
    data: {
      score: attempt.score,
      passMark: attempt.passMark,
      passed: attempt.passed,
      correct: result.marked.filter((m) => m.correct).length,
      total: result.marked.length,
      status: application.status,
      review: showAnswers
        ? attempt.served.map((q) => {
            const given = result.marked.find((m) => m.key === q.key);
            return {
              prompt: q.prompt,
              options: q.options,
              type: q.type,
              answers: q.answers,
              accepted: q.accepted,
              given: given?.chosen ?? given?.text ?? null,
              correct: given?.correct,
              explanation: q.explanation,
            };
          })
        : null,
    },
  });
});
