import { Link } from 'react-router-dom';
import {
  Award, BookOpen, CalendarClock, Check, ExternalLink, FileCheck2, Hourglass, MessageSquareWarning, PlayCircle, Receipt,
} from 'lucide-react';

import { Meter } from './kit.jsx';
import { money } from '../../lib/format.js';

/**
 * One application, drawn as progress rather than as a record.
 *
 * The server has already decided what matters: /me/dashboard returns only the
 * steps that are still outstanding, in order. So the first one is what this
 * person can do today, and everything after it is what comes next.
 */

export const STATUS = {
  draft: ['Draft', 'tag'],
  fee_pending: ['Fee due', 'tag tag-gold'],
  submitted: ['Submitted', 'tag tag-blue'],
  under_review: ['Under review', 'tag'],
  info_requested: ['Needs your reply', 'tag tag-gold'],
  coursework: ['Coursework', 'tag tag-gold'],
  assessment: ['Paper to sit', 'tag tag-gold'],
  interview: ['Interview', 'tag tag-gold'],
  final_review: ['Final review', 'tag'],
  approved: ['Approved', 'tag tag-blue'],
  issued: ['Issued', 'tag tag-blue'],
  declined: ['Declined', 'tag tag-red'],
  withdrawn: ['Withdrawn', 'tag'],
  expired: ['Expired', 'tag tag-red'],
};

export const StatusTag = ({ status }) => {
  const [label, cls] = STATUS[status] ?? [status, 'tag'];
  return <span className={cls}>{label}</span>;
};

const ICON = { size: 14, strokeWidth: 1.8 };

/** What this step is, and the one thing it wants. */
const stepFace = (step, reference) => {
  switch (step.type) {
    case 'fee':
      return {
        icon: <Receipt {...ICON} />,
        detail: step.detail,
        action: <Link to={`/applications/${reference}`} className="btn btn-primary btn-sm">Pay the fee</Link>,
      };
    case 'assessment':
      return {
        icon: <FileCheck2 {...ICON} />,
        detail: step.detail,
        action: <Link to={`/applications/${reference}/assessment`} className="btn btn-primary btn-sm">Sit the paper</Link>,
      };
    case 'interview':
      return {
        icon: <CalendarClock {...ICON} />,
        detail: step.detail,
        action: (
          <Link to={`/applications/${reference}/interview`} className="btn btn-primary btn-sm">
            {step.meta?.booked ? 'See the details' : 'Book a time'}
          </Link>
        ),
      };
    case 'course':
      return step.course
        ? {
            icon: <BookOpen {...ICON} />,
            detail: step.course.title,
            below: (
              <div className="stack stack-2" style={{ marginTop: 8, maxWidth: 320 }}>
                <Meter value={step.progress ?? 0} />
                <span className="xs dim num">{step.progress ?? 0}% complete</span>
              </div>
            ),
            action: (
              <Link to={`/learn/${step.course.slug}`} className="btn btn-outline btn-sm" style={{ marginTop: 8 }}>
                <PlayCircle size={14} /> {(step.progress ?? 0) > 0 ? 'Continue' : 'Start'}
              </Link>
            ),
          }
        : { icon: <BookOpen {...ICON} />, detail: step.detail };
    case 'credential':
      return step.offering
        ? {
            icon: <Award {...ICON} />,
            detail: `${step.offering.title} — required before this can be issued`,
            action: (
              <Link to={`/listing/${step.offering.slug}`} className="btn btn-primary btn-sm">
                {step.offering.fee?.amount ? money(step.offering.fee.amount) : 'Take a look'}
              </Link>
            ),
          }
        : { icon: <Award {...ICON} />, detail: step.detail };
    case 'review':
      // Nothing to do. Saying so is more useful than a button.
      return { icon: <Hourglass {...ICON} />, detail: step.detail || 'Nothing needed from you while this is read.', waiting: true };
    default:
      return {
        icon: <FileCheck2 {...ICON} />,
        detail: step.detail,
        action: <Link to={`/applications/${reference}`} className="btn btn-outline btn-sm">Open</Link>,
      };
  }
};

export const ApplicationTile = ({ app, limit = 4, i = 0 }) => {
  const steps = app.steps ?? [];
  const shown = steps.slice(0, limit);

  return (
    <article className="me-tile me-tile-toned" style={{ '--i': i }}>
      <div className="me-tile-body">
        <div className="row-between" style={{ alignItems: 'flex-start', gap: 'var(--s-4)' }}>
          <div className="row" style={{ gap: 'var(--s-4)', alignItems: 'flex-start', minWidth: 0 }}>
            {app.offering?.coverImage ? (
              <span className="me-row-art" style={{ width: 84 }}>
                <img src={app.offering.coverImage} alt="" loading="lazy" />
              </span>
            ) : null}
            <div style={{ minWidth: 0 }}>
              <h3 className="clamp-2">
                <Link to={`/applications/${app.reference}`}>{app.offeringTitle}</Link>
              </h3>
              <div className="me-tile-meta">
                <span className="clamp-1">{app.church?.name}</span>
              </div>
            </div>
          </div>
          <StatusTag status={app.status} />
        </div>

        {app.infoRequest?.message ? (
          <div className="notice notice-gold" style={{ marginTop: 'var(--s-2)' }}>
            <MessageSquareWarning size={15} />
            <span>
              <b>{app.church?.name} has asked you for something.</b>{' '}
              {app.infoRequest.message}{' '}
              <Link className="link" to={`/applications/${app.reference}`}>Reply</Link>
            </span>
          </div>
        ) : null}

        {shown.length ? (
          <div className="me-steps" style={{ marginTop: 'var(--s-3)', paddingTop: 'var(--s-4)', borderTop: '1px solid var(--line)' }}>
            {shown.map((step, n) => {
              const face = stepFace(step, app.reference);
              const state = face.waiting ? 'todo' : n === 0 ? 'now' : 'todo';
              return (
                <div key={step.key ?? n} className="me-step">
                  <span className={`me-step-dot ${state === 'now' ? 'me-step-now' : ''}`}>{face.icon}</span>
                  <div className="me-step-copy">
                    <b>{step.label}</b>
                    {face.detail ? <span>{face.detail}</span> : null}
                    {face.below ?? null}
                    {face.action ? <div>{face.action}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="row small muted" style={{ gap: 8, marginTop: 'var(--s-3)', paddingTop: 'var(--s-4)', borderTop: '1px solid var(--line)' }}>
            <Check size={15} color="var(--blue-600)" />
            Everything asked of you is done. {app.church?.name} has it from here.
          </div>
        )}
      </div>

      {steps.length > limit ? (
        <div className="me-tile-foot">
          <span className="small muted">{steps.length - limit} more step{steps.length - limit === 1 ? '' : 's'} after these</span>
          <Link className="link small" to={`/applications/${app.reference}`}>
            See all <ExternalLink size={13} />
          </Link>
        </div>
      ) : null}
    </article>
  );
};
