import { Link } from 'react-router-dom';
import { ArrowRight, Award, Clock, Layers, MapPin, ShoppingBag } from 'lucide-react';

import { compact, duration, plural } from '../lib/format.js';
import { useCart } from '../lib/cart.jsx';
import { Monogram, Price, Stars, Verified } from './ui.jsx';

export const CourseCard = ({ course }) => {
  const { add, has } = useCart();
  const church = course.church;
  const inCart = has('course', course.slug);
  return (
    <article className="card course-card">
      {course.bestseller && <span className="flag badge-bestseller">Bestseller</span>}
      <Link to={`/courses/${course.slug}`} className="media media-3x2" tabIndex={-1} aria-hidden="true">
        <img src={course.coverImage} alt="" loading="lazy" width={800} height={534} />
      </Link>
      <div className="card-body">
        <span className="xs dim">{course.category}</span>
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
          <span className="row" style={{ gap: 4 }}><Clock size={12} />{duration(course.totalMinutes)}</span>
          <span className="dot" />
          <span>{plural(course.lectureCount ?? 0, 'lesson')}</span>
          <span className="dot" />
          <span>{course.level}</span>
        </div>
        <div className="course-foot">
          <Price amount={course.price} was={course.compareAtPrice} currency={course.currency} />
          {course.certificate?.kind && <span className="tag tag-gold"><Award size={12} />{course.certificate.kind}</span>}
        </div>
        {inCart ? (
          <Link to="/cart" className="btn btn-outline btn-sm btn-block card-buy">In your basket <ArrowRight size={14} /></Link>
        ) : (
          <button type="button" className="btn btn-outline btn-sm btn-block card-buy"
            onClick={() => add({ kind: 'course', slug: course.slug })}>
            <ShoppingBag size={14} /> Add to basket
          </button>
        )}
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

export const ChurchCard = ({ church }) => (
  <article className="card church-card">
    <Link to={`/churches/${church.slug}`} className="media media-3x2" tabIndex={-1} aria-hidden="true">
      <img src={church.coverImage} alt="" loading="lazy" width={800} height={534} />
    </Link>
    <div className="card-body">
      <div className="row" style={{ gap: 10 }}>
        <Monogram text={church.monogram} size="monogram-sm" />
        <div className="grow">
          <h3 className="course-title clamp-1"><Link to={`/churches/${church.slug}`}>{church.shortName ?? church.name}</Link></h3>
          <span className="row xs dim" style={{ gap: 4 }}><MapPin size={11} />{church.city}, {church.country}</span>
        </div>
      </div>
      <p className="small muted clamp-2" style={{ margin: 0 }}>{church.tagline}</p>
      <div className="row-wrap" style={{ gap: 6 }}>
        {(church.specialties ?? []).slice(0, 2).map((s) => <span key={s} className="tag">{s}</span>)}
      </div>
      <div className="course-foot">
        <span className="small muted num">
          {plural(church.stats?.courses ?? 0, 'course')} · {compact(church.stats?.learners ?? 0)} learners
        </span>
        {church.verified && <Verified label="Verified" size={13} />}
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
      <span className="tag tag-green" style={{ alignSelf: 'flex-start' }}><Layers size={12} />{pathway.category} pathway</span>
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
