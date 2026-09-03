import { Link } from 'react-router-dom';
import {
  Award, BadgeCheck, BookOpen, CalendarClock, ClipboardCheck, FileCheck2, Layers, MapPin, Plane, ScrollText,
} from 'lucide-react';

import { compact, money, plural } from '../lib/format.js';

/**
 * How a credential is obtained. The single most important thing on a listing,
 * because it is what actually differs between two churches issuing the same
 * title.
 *
 * There is no longer an "issued instantly" mode for anything that confers
 * standing: a credential cannot be published without a church decision behind
 * it. The mode survives for affiliations and letters, which are relationships
 * and supporting documents rather than titles.
 */
export const ACQUISITION = {
  instant: { label: 'Issued on request', icon: FileCheck2, tone: '', help: 'Issued once your details are confirmed.' },
  application: { label: 'By application', icon: ScrollText, tone: '', help: 'Apply and the church reviews your application.' },
  assessment: { label: 'Written assessment', icon: ClipboardCheck, tone: '', help: 'Includes a written assessment.' },
  coursework: { label: 'Coursework', icon: BookOpen, tone: '', help: 'Requires completing specific courses.' },
  credentials: { label: 'Builds on others', icon: Layers, tone: 'gold', help: 'Requires credentials you already hold.' },
  interview: { label: 'Interview', icon: CalendarClock, tone: '', help: 'Includes an interview with the church.' },
  review: { label: 'Church review', icon: FileCheck2, tone: '', help: 'Reviewed by the church before issue.' },
};

/** Types that confer standing. Never merchandised, never discounted. */
const CONFERS_STANDING = ['ordination', 'certificate', 'license', 'diploma', 'letter-of-standing'];
export const confersStanding = (type) => CONFERS_STANDING.includes(type);

export const AcquisitionTag = ({ mode, size = 12 }) => {
  const a = ACQUISITION[mode] ?? ACQUISITION.application;
  const Icon = a.icon;
  return (
    <span className={`tag ${a.tone ? `tag-${a.tone}` : ''}`} title={a.help}>
      <Icon size={size} /> {a.label}
    </span>
  );
};

export const OutcomeIcon = ({ name, size = 18, ...rest }) => {
  const map = { flame: Award, award: Award, scroll: FileCheck2, link: BadgeCheck, plane: Plane };
  const Icon = map[name] ?? Award;
  return <Icon size={size} {...rest} />;
};

/** What the fee is, said plainly. */
const Fee = ({ offering: o }) => {
  const amount = o.fee?.amount ?? o.price ?? 0;
  if (!amount) return <span className="price-big">Free</span>;

  return (
    <span className="stack" style={{ gap: 0 }}>
      <span className="price-big">{money(amount, o.currency)}</span>
      <span className="xs dim">{confersStanding(o.type) ? 'to apply' : ''}</span>
    </span>
  );
};

/**
 * The listing card.
 *
 * The issuing church leads, because nobody seeks standing without knowing who
 * grants it. The action is "apply", not "add to basket" — a title is not a
 * thing you put in a bag.
 */
export const OfferingCard = ({ offering: o, showOutcome = false, held = false }) => {
  const church = o.church;
  const badge = !confersStanding(o.type) && o.badge && o.badge !== ACQUISITION[o.acquisition]?.label ? o.badge : null;

  return (
    <article className="card offer-card">
      {badge && <span className="flag badge-bestseller">{badge}</span>}
      <Link to={`/listing/${o.slug}`} className="media media-3x2" tabIndex={-1} aria-hidden="true">
        <img
          src={o.coverImage}
          alt=""
          loading="lazy"
          width={800}
          height={534}
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/media/scenes/books-colorful.webp'; }}
        />
      </Link>
      <div className="card-body">
        {church && (
          <Link to={`/churches/${church.slug}`} className="row issuer" style={{ gap: 7 }}>
            <span className="monogram monogram-sm">{church.monogram}</span>
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="small strong clamp-1" style={{ display: 'block', lineHeight: 1.25 }}>
                {church.shortName ?? church.name}
              </span>
              <span className="xs dim">{church.country}</span>
            </span>
            {church.verified && <BadgeCheck size={15} style={{ color: 'var(--green-600)', flex: 'none' }} />}
          </Link>
        )}

        <Link to={`/listing/${o.slug}`} className="offer-title clamp-2">{o.title}</Link>
        {showOutcome ? <span className="xs dim">{o.outcome}</span> : null}

        <div className="row-wrap" style={{ gap: 6 }}>
          <AcquisitionTag mode={o.acquisition} />
          {o.letter?.destinationCity && <span className="tag"><Plane size={12} />{o.letter.destinationCity}</span>}
        </div>

        <div className="offer-foot">
          <Fee offering={o} />
          <span className="xs dim num">{compact(o.issuedCount ?? 0)} issued</span>
        </div>

        {held ? (
          <Link to="/me/passport" className="btn btn-outline btn-sm btn-block card-buy">In your passport</Link>
        ) : (
          <Link to={`/listing/${o.slug}`} className="btn btn-outline btn-sm btn-block card-buy">
            View details
          </Link>
        )}
      </div>
    </article>
  );
};

/**
 * The comparison row on an outcome page.
 *
 * Every listing in a bucket is the same title — eight churches all call it
 * "Ordained Minister" — so the title carries no information and the issuing
 * church does. The church leads; below it sits the spec people actually compare
 * on: what it asks, how long it takes, how long it lasts.
 */
export const OfferingRow = ({ offering: o, owned, applied }) => {
  const church = o.church;
  const standing = confersStanding(o.type);
  const badge = !standing && o.badge && o.badge !== ACQUISITION[o.acquisition]?.label ? o.badge : null;

  const turnaround = o.requires?.review?.turnaroundDays ?? o.letter?.turnaroundDays;
  const timeToDecide = turnaround
    ? `about ${plural(turnaround, 'day')}`
    : o.acquisition === 'coursework'
      ? 'When the coursework is done'
      : o.acquisition === 'interview'
        ? 'After the interview'
        : o.acquisition === 'credentials'
          ? 'Once you hold the rest'
          : 'Decided by the church';

  const months = o.award?.validityMonths;
  const validity = !months
    ? 'Held for life'
    : `${months >= 12 ? plural(Math.round(months / 12), 'year') : plural(months, 'month')}${o.award?.renewable ? ', renewable' : ''}`;

  const needs = [
    o.requires?.credentials?.length && plural(o.requires.credentials.length, 'credential'),
    o.requires?.courses?.length && plural(o.requires.courses.length, 'course'),
    o.requires?.assessment?.required && 'an assessment',
    o.requires?.interview?.required && 'an interview',
  ].filter(Boolean).join(' + ');

  return (
    <article className="offer-row">
      <Link to={`/listing/${o.slug}`} className="media" tabIndex={-1} aria-hidden="true">
        <img
          src={o.coverImage}
          alt=""
          loading="lazy"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/media/scenes/books-colorful.webp'; }}
        />
      </Link>

      <div className="offer-row-main">
        <Link to={`/listing/${o.slug}`} className="offer-row-church">
          <span className="offer-row-name">
            {church?.shortName ?? church?.name ?? o.churchSlug}
            {church?.verified && (
              <BadgeCheck size={15} style={{ display: 'inline', marginLeft: 5, verticalAlign: '-3px', color: 'var(--green-600)' }} />
            )}
          </span>
          <span className="xs dim row" style={{ gap: 4 }}>
            <MapPin size={11} />{church?.city}, {church?.country}
            {church?.foundedYear ? ` · founded ${church.foundedYear}` : ''}
          </span>
        </Link>

        <div className="row-wrap" style={{ gap: 8 }}>
          {badge && <span className="badge-bestseller">{badge}</span>}
          <AcquisitionTag mode={o.acquisition} />
          {o.letter?.destinationCity && <span className="tag"><Plane size={12} />{o.letter.destinationCity}</span>}
        </div>

        <p className="small muted" style={{ margin: 0 }}>
          <span className="strong" style={{ color: 'var(--ink)' }}>{o.award?.title ?? o.title}</span>
          {o.subtitle ? ` — ${o.subtitle}` : ''}
        </p>

        <dl className="offer-spec">
          <div><dt>Decision</dt><dd>{timeToDecide}</dd></div>
          <div><dt>Requirements</dt><dd>{needs || 'Your details'}</dd></div>
          <div><dt>Valid</dt><dd>{validity}</dd></div>
        </dl>
      </div>

      <div className="offer-row-buy">
        <div className="offer-price">
          <Fee offering={o} />
          <span className="xs dim num offer-issued">{compact(o.issuedCount ?? 0)} issued</span>
        </div>

        {owned ? (
          <div className="offer-actions is-single">
            <Link to="/me/passport" className="btn btn-outline btn-sm btn-block">In your passport</Link>
          </div>
        ) : applied ? (
          <div className="offer-actions is-single">
            <Link to={`/applications/${applied.reference}`} className="btn btn-outline btn-sm btn-block">Your application</Link>
          </div>
        ) : (
          <div className="offer-actions">
            <Link to={`/listing/${o.slug}`} className="btn btn-primary btn-sm btn-block">View</Link>
            <Link to={`/apply/${o.slug}`} className="btn btn-outline btn-sm btn-block">Apply</Link>
          </div>
        )}
      </div>
    </article>
  );
};
