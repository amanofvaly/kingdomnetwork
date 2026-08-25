import { Link } from 'react-router-dom';
import {
  Award, BadgeCheck, BookOpen, ClipboardCheck, FileCheck2, Layers, MapPin, Plane, Zap,
} from 'lucide-react';

import { compact, money, plural } from '../lib/format.js';

/** How you get it. The single most important thing on a listing after the price. */
export const ACQUISITION = {
  instant: { label: 'Issued instantly', icon: Zap, tone: 'green', help: 'Issued to your passport as soon as you pay.' },
  assessment: { label: 'Short assessment', icon: ClipboardCheck, tone: '', help: 'Answer a set of questions here, then it is issued.' },
  coursework: { label: 'Coursework', icon: BookOpen, tone: '', help: 'The course is unlocked when you pay. Finish it and the credential is issued.' },
  credentials: { label: 'Requires credentials', icon: Layers, tone: 'gold', help: 'You must already hold the credentials this church names.' },
  review: { label: 'Church review', icon: FileCheck2, tone: '', help: 'The church checks your documents before signing.' },
};

export const AcquisitionTag = ({ mode, size = 12 }) => {
  const a = ACQUISITION[mode] ?? ACQUISITION.instant;
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

/** The marketplace card. Price is the loudest thing on it after the title. */
export const OfferingCard = ({ offering: o, showOutcome = false }) => {
  const church = o.church;
  const badge = o.badge && o.badge !== ACQUISITION[o.acquisition]?.label ? o.badge : null;
  return (
    <article className="card offer-card">
      {badge && <span className="flag badge-bestseller">{badge}</span>}
      <Link to={`/listing/${o.slug}`} className="media media-3x2" tabIndex={-1} aria-hidden="true">
        <img src={o.coverImage} alt="" loading="lazy" width={800} height={534} />
      </Link>
      <div className="card-body">
        {church && (
          <Link to={`/churches/${church.slug}`} className="row issuer" style={{ gap: 7 }}>
            <span className="monogram monogram-sm">{church.monogram}</span>
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="small strong clamp-1" style={{ display: 'block', lineHeight: 1.25 }}>
                {church.shortName ?? church.name}
              </span>
              <span className="xs dim row" style={{ gap: 4 }}>
                <MapPin size={10} />{church.country}
                {church.verified && <BadgeCheck size={11} style={{ color: 'var(--green-600)' }} />}
              </span>
            </span>
          </Link>
        )}

        <h3 className="offer-title clamp-2">
          <Link to={`/listing/${o.slug}`}>{o.title}</Link>
        </h3>
        {o.subtitle && <p className="small muted clamp-2" style={{ margin: 0 }}>{o.subtitle}</p>}

        <div className="row-wrap" style={{ gap: 6 }}>
          <AcquisitionTag mode={o.acquisition} />
          {showOutcome && o.award?.postNominal && <span className="tag">Styled {o.award.postNominal}</span>}
          {o.letter?.destinationCity && <span className="tag"><Plane size={12} />{o.letter.destinationCity}</span>}
        </div>

        <div className="offer-foot">
          <span className="row" style={{ gap: 8, alignItems: 'baseline' }}>
            <span className="price-big">{money(o.price, o.currency)}</span>
            {o.compareAtPrice > o.price && <span className="price-was">{money(o.compareAtPrice, o.currency)}</span>}
          </span>
          <span className="xs dim num">{compact(o.issuedCount ?? 0)} issued</span>
        </div>
      </div>
    </article>
  );
};

/**
 * The comparison row on an outcome page.
 *
 * Every listing in a bucket sells the same thing — eight churches all call it
 * "Ordained Minister" — so the title is the constant and carries no
 * information. The issuing church is the variable, so the church leads and the
 * title drops to a supporting line. Below it sits the spec people actually
 * compare on: how it is issued, how long it takes, how long it lasts.
 */
export const OfferingRow = ({ offering: o, onAdd, owned }) => {
  const church = o.church;
  const discount = o.compareAtPrice > o.price ? Math.round((1 - o.price / o.compareAtPrice) * 100) : 0;
  const badge = o.badge && o.badge !== ACQUISITION[o.acquisition]?.label ? o.badge : null;

  const turnaround = o.requires?.review?.turnaroundDays ?? o.letter?.turnaroundDays;
  const timeToIssue = turnaround
    ? `about ${plural(turnaround, 'day')}`
    : o.acquisition === 'instant'
      ? 'Immediately'
      : o.acquisition === 'assessment'
        ? `${o.requires?.assessment?.minutes ?? 30} min assessment`
        : o.acquisition === 'coursework'
          ? 'On finishing the course'
          : 'Once you hold the rest';

  const months = o.award?.validityMonths;
  const validity = !months
    ? 'Held for life'
    : `${months >= 12 ? plural(Math.round(months / 12), 'year') : plural(months, 'month')}${o.award?.renewable ? ', renewable' : ''}`;

  const needs = [
    o.requires?.credentials?.length && plural(o.requires.credentials.length, 'credential'),
    o.requires?.courses?.length && plural(o.requires.courses.length, 'course'),
  ].filter(Boolean).join(' + ');

  return (
    <article className="offer-row">
      <Link to={`/listing/${o.slug}`} className="media" tabIndex={-1} aria-hidden="true">
        <img src={o.coverImage} alt="" loading="lazy" />
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
          <div><dt>Issued</dt><dd>{timeToIssue}</dd></div>
          <div><dt>Requires</dt><dd>{needs || 'Nothing'}</dd></div>
          <div><dt>Valid</dt><dd>{validity}</dd></div>
        </dl>
      </div>

      <div className="offer-row-buy">
        <div className="offer-price">
          <span className="price-big">{money(o.price, o.currency)}</span>
          {discount > 0 && <span className="price-was">{money(o.compareAtPrice, o.currency)}</span>}
          {discount > 0 && <span className="tag tag-red">{discount}% off</span>}
          <span className="xs dim num offer-issued">{compact(o.issuedCount ?? 0)} issued</span>
        </div>

        {owned ? (
          <div className="offer-actions is-single">
            <Link to="/passport" className="btn btn-outline btn-sm btn-block">In your passport</Link>
          </div>
        ) : (
          <div className={`offer-actions ${onAdd ? '' : 'is-single'}`}>
            <Link to={`/listing/${o.slug}`} className="btn btn-primary btn-sm btn-block">View</Link>
            {onAdd && (
              <button type="button" className="btn btn-outline btn-sm btn-block" onClick={() => onAdd(o)}>
                Add to basket
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
