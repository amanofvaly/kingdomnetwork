import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, BadgeCheck, Clock, Layers, MapPin, ShoppingBag } from 'lucide-react';

import { duration, plural } from '../lib/format.js';
import { useCart } from '../lib/cart.jsx';
import { Price, Stars, Verified } from './ui.jsx';
import { FollowButton } from './me/feed.jsx';

/**
 * A designed jacket already says what it is.
 *
 * The material covers are authored SVGs that carry the church, the kind and the
 * extent in their own composition. Laying the card's fact strip over one of
 * those repeats every word of it and reads as UI chrome pasted onto a poster —
 * so the strip is for photographs, and a jacket keeps its facts in the body.
 */
const isDesignedJacket = (src) => /\.svg(\?|$)/i.test(src ?? '');

export const CourseCard = ({ course }) => {
  const { add, has } = useCart();
  const church = course.church;
  const inCart = has('course', course.slug);
  const jacket = isDesignedJacket(course.coverImage);
  return (
    <article className="card course-card">
      {course.bestseller && <span className="flag badge-bestseller">Bestseller</span>}
      {course.certificate?.kind && (
        <span className="flag-right tag tag-gold"><Award size={12} />{course.certificate.kind}</span>
      )}
      <div className="card-cover">
        <Link to={`/courses/${course.slug}`} className="media media-3x2" tabIndex={-1} aria-hidden="true">
          <img src={course.coverImage} alt="" loading="lazy" width={800} height={534} />
        </Link>
        {jacket ? null : (
          <div className="cover-meta">
            <span>{course.category}</span>
            <span className="cover-meta-end"><Clock size={11} />{duration(course.totalMinutes)}</span>
          </div>
        )}
      </div>
      <div className="card-body">
        <h3 className="course-title clamp-2">
          <Link to={`/courses/${course.slug}`}>{course.title}</Link>
        </h3>
        {church && (
          <Link to={`/churches/${church.slug}`} className="row small muted" style={{ gap: 6 }}>
            <span className="clamp-1">{church.shortName ?? church.name}</span>
            {church.verified && <Verified label="" size={13} />}
          </Link>
        )}
        <div className="row" style={{ gap: 8 }}>
          <Stars rating={course.rating} count={course.ratingCount} size={13} />
        </div>
        <div className="course-meta">
          {jacket ? <><span>{course.category}</span><span className="dot" /></> : null}
          <span>{plural(course.lectureCount ?? 0, 'lesson')}</span>
          <span className="dot" />
          <span>{course.level}</span>
        </div>
        <div className="course-foot course-foot-buy">
          <Price amount={course.price} was={course.compareAtPrice} currency={course.currency} />
          {inCart ? (
            <Link to="/cart" className="btn btn-outline btn-sm">In your basket <ArrowRight size={14} /></Link>
          ) : (
            <button type="button" className="btn btn-outline btn-sm"
              onClick={() => add({ kind: 'course', slug: course.slug })}>
              <ShoppingBag size={14} /> Add to basket
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

export const CourseRow = ({ course, action }) => (
  <article className="card" style={{ flexDirection: 'row', alignItems: 'stretch' }}>
    <Link to={`/courses/${course.slug}`} className="media" style={{ width: 168, flex: 'none', borderRadius: 0 }} tabIndex={-1} aria-hidden="true">
      <img src={course.coverImage} alt="" loading="lazy" />
    </Link>
    <div className="card-body">
      <h3 className="course-title clamp-2"><Link to={`/courses/${course.slug}`}>{course.title}</Link></h3>
      {course.church && <span className="small muted">{course.church.shortName ?? course.church.name}</span>}
      <div className="course-meta">
        <span>{duration(course.totalMinutes)}</span>
        <span className="dot" />
        <span>{plural(course.lectureCount ?? 0, 'lesson')}</span>
      </div>
      {action}
    </div>
  </article>
);

/**
 * A church in the directory.
 *
 * Where a church is has no bearing on whether you want to read the rest of the
 * card, so it sits on the cover and the name gets the two lines it needs — a
 * ministry called "Rock Word of Instruction International" was being cut off
 * mid-word at the exact width most people hold a phone at.
 */
export const ChurchCard = ({ church, canFollow = false, following = false, onFollowChange }) => (
  <article className="card church-card">
    <div className="card-cover">
      <Link to={`/churches/${church.slug}`} className="media media-3x2" tabIndex={-1} aria-hidden="true">
        <img src={church.coverImage} alt="" loading="lazy" width={800} height={534} />
      </Link>
      {church.verified ? (
        <span className="verified-badge"><BadgeCheck size={11} strokeWidth={2.6} />Verified</span>
      ) : null}
      <div className="cover-meta">
        <span><MapPin size={11} />{church.city || church.country}</span>
        <span className="cover-meta-end num">{plural(church.stats?.courses ?? 0, 'course')}</span>
      </div>
    </div>
    <div className="card-body">
      <h3 className="course-title clamp-2"><Link to={`/churches/${church.slug}`}>{church.shortName ?? church.name}</Link></h3>
      <p className="small muted clamp-2" style={{ margin: 0 }}>{church.tagline}</p>
      <div className="row-wrap" style={{ gap: 6 }}>
        {(church.specialties ?? []).slice(0, 2).map((s) => <span key={s} className="tag">{s}</span>)}
      </div>
      <div className="course-foot">
        <span className="small muted num">{plural(church.followers ?? 0, 'follower')}</span>
        {canFollow ? (
          <FollowButton variant="text" slug={church.slug} following={following} onChange={onFollowChange} />
        ) : null}
      </div>
    </div>
  </article>
);

export const PathwayCard = ({ pathway }) => (
  <article className="card course-card">
    <Link to={`/pathways/${pathway.slug}`} className="media media-3x2" tabIndex={-1} aria-hidden="true">
      <img src={pathway.coverImage} alt="" loading="lazy" width={800} height={534} />
    </Link>
    <div className="card-body">
      <span className="tag tag-blue" style={{ alignSelf: 'flex-start' }}><Layers size={12} />{pathway.category} pathway</span>
      <h3 className="course-title clamp-2"><Link to={`/pathways/${pathway.slug}`}>{pathway.title}</Link></h3>
      <p className="small muted clamp-2" style={{ margin: 0 }}>{pathway.subtitle}</p>
      <div className="course-meta">
        <span>{plural((pathway.steps ?? []).length, 'stage')}</span>
        <span className="dot" />
        <span>about {pathway.months} months</span>
      </div>
      <div className="course-foot">
        <Price amount={pathway.price} was={pathway.compareAtPrice} />
        <span className="tag tag-gold"><Award size={12} />{pathway.award?.kind}</span>
      </div>
    </div>
  </article>
);

const MATERIAL_KIND_LABEL = {
  course: 'Course',
  book: 'Book',
  audiobook: 'Audiobook',
  'study-guide': 'Study guide',
  'sermon-series': 'Sermon series',
  album: 'Album',
  workbook: 'Workbook',
};

/**
 * One card for the whole catalogue.
 *
 * A course and a book are both things you buy, so they are not styled apart —
 * the tag is what tells them apart, and the price and basket are common to
 * both. The line DESIGN.md draws is between a material and standing, and
 * standing is not on this shelf.
 *
 * Tolerant about where the minutes come from, because the same card renders a
 * projected catalogue row, a raw resource from a church page, and a search hit.
 */
export const MaterialCard = ({ item }) => {
  const { add, has } = useCart();
  const isCourse = item.kind === 'course';
  const cartKind = isCourse ? 'course' : 'resource';
  const to = isCourse ? `/courses/${item.slug}` : `/materials/${item.slug}`;
  const inCart = has(cartKind, item.slug);
  const church = item.church;
  const minutes = item.minutes ?? item.durationMinutes ?? item.totalMinutes;

  // What it is and how long it takes ride on the cover; what is left describes
  // the thing itself and stays with the title.
  const extent = minutes ? duration(minutes) : (!isCourse && item.pages ? plural(item.pages, 'page') : null);
  const jacket = isDesignedJacket(item.coverImage);
  const kind = MATERIAL_KIND_LABEL[item.kind] ?? item.kind;
  const facts = [
    jacket ? kind : null,
    jacket ? extent : null,
    isCourse && item.lectureCount ? plural(item.lectureCount, 'lesson') : null,
    isCourse ? item.level : item.authorName,
  ].filter(Boolean);

  return (
    <article className="card course-card">
      {item.bestseller && <span className="flag badge-bestseller">Bestseller</span>}
      <div className="card-cover">
        <Link to={to} className="media media-3x2" tabIndex={-1} aria-hidden="true">
          <img src={item.coverImage} alt="" loading="lazy" width={800} height={534} />
        </Link>
        {jacket ? null : (
          <div className="cover-meta">
            <span>{kind}</span>
            {extent ? <span className="cover-meta-end"><Clock size={11} />{extent}</span> : null}
          </div>
        )}
      </div>
      <div className="card-body">
        <h3 className="course-title clamp-2"><Link to={to}>{item.title}</Link></h3>
        {church && (
          <Link to={`/churches/${church.slug}`} className="row small muted" style={{ gap: 6 }}>
            <span className="clamp-1">{church.shortName ?? church.name}</span>
            {church.verified && <Verified label="" size={13} />}
          </Link>
        )}
        {isCourse && item.rating ? (
          <div className="row" style={{ gap: 8 }}>
            <Stars rating={item.rating} count={item.ratingCount} size={13} />
          </div>
        ) : null}
        {facts.length ? (
          <div className="course-meta">
            {facts.map((fact, i) => (
              <Fragment key={fact}>{i > 0 && <span className="dot" />}<span>{fact}</span></Fragment>
            ))}
          </div>
        ) : null}
        <div className="course-foot course-foot-buy">
          {item.price
            ? <Price amount={item.price} was={item.compareAtPrice} currency={item.currency} />
            : <span className="badge-free">Free</span>}
          {inCart ? (
            <Link to="/cart" className="btn btn-outline btn-sm">In your basket <ArrowRight size={14} /></Link>
          ) : (
            <button type="button" className="btn btn-outline btn-sm"
              onClick={() => add({ kind: cartKind, slug: item.slug })}>
              <ShoppingBag size={14} /> Add to basket
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
