import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight, Award, BookOpen, Check, ChevronDown, Clock, FileText, Globe, GraduationCap,
  Headphones, Infinity as InfinityIcon, PlayCircle, ShoppingBag, Signal, Sparkles, Users,
} from 'lucide-react';

import { Avatar, Breadcrumbs, ErrorState, ChurchMark, Price, Spinner, Stars, Verified } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { useCart } from '../lib/cart.jsx';
import { useAuth } from '../lib/auth.jsx';
import { compact, duration, hours, money, monthsAgo, plural } from '../lib/format.js';

const KIND_ICON = { video: PlayCircle, audio: Headphones, reading: FileText, quiz: Sparkles, assignment: Award };

const Section = ({ section, open, onToggle }) => {
  const minutes = section.lectures.reduce((n, l) => n + (l.minutes ?? 0), 0);
  return (
    <div className="sec">
      <button type="button" className="sec-head" aria-expanded={open} onClick={onToggle}>
        <ChevronDown size={17} className="chev" />
        <span className="grow">
          <span className="sec-title">{section.title}</span>
          {section.summary && <span className="xs dim" style={{ display: 'block' }}>{section.summary}</span>}
        </span>
        <span className="sec-meta">{plural(section.lectures.length, 'lesson')} · {duration(minutes)}</span>
      </button>
      {open && (
        <div>
          {section.lectures.map((l) => {
            const Icon = KIND_ICON[l.kind] ?? PlayCircle;
            return (
              <div key={l.id} className="lec">
                <Icon size={15} strokeWidth={1.7} />
                <span className="t clamp-1">{l.title}</span>
                {l.preview && <span className="lec-preview xs">Preview</span>}
                <span className="m">{l.minutes}m</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const CourseDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(`/courses/${slug}`);
  const { has, add } = useCart();
  const { user } = useAuth();
  const { data: entitlements } = useApi('/me/entitlements', { skip: !user });

  const [open, setOpen] = useState(() => new Set([0]));
  const [showAllReviews, setShowAllReviews] = useState(false);

  if (loading) return <div className="wrap band"><Spinner label="Loading course" /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const { course, church, instructors, reviews, reviewBreakdown, unlocks } = data;
  const owned = entitlements?.courses.some((c) => c.slug === course.slug);
  const primary = unlocks?.[0];
  const inCart = has('course', course.slug);
  const totalReviews = reviews.length || 1;

  const toggle = (i) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const buy = () => {
    if (!inCart) add({ kind: 'course', slug: course.slug });
    navigate('/cart');
  };

  return (
    <>
      <div className="detail-head">
        <div className="wrap stack stack-4">
          <Breadcrumbs trail={[
            { label: 'Courses', to: '/courses' },
            { label: course.category, to: `/learning?category=${encodeURIComponent(course.category)}` },
            { label: course.title },
          ]} />
          <div>
            <div className="stack stack-4" style={{ maxWidth: '64ch' }}>
              <div className="row-wrap">
                {course.bestseller && <span className="badge-bestseller">Bestseller</span>}
                <span className="tag">{course.level}</span>
                {course.certificate?.awarded && <span className="tag tag-gold"><Award size={12} />{course.certificate.kind} on completion</span>}
              </div>
              <h1 style={{ fontSize: 'clamp(1.9rem, 3.4vw, 2.75rem)' }}>{course.title}</h1>
              <p className="lede">{course.subtitle}</p>

              <div className="row-wrap" style={{ gap: 'var(--s-4)' }}>
                <Stars rating={course.rating} count={course.ratingCount} size={15} />
                <span className="row small muted" style={{ gap: 6 }}><Users size={14} />{compact(course.learners)} learners</span>
                <span className="row small muted" style={{ gap: 6 }}><Globe size={14} />{course.language}</span>
                <span className="small dim">Updated {course.updatedMonth}</span>
              </div>

              {church && (
                <Link to={`/churches/${church.slug}`} className="row" style={{ gap: 12 }}>
                  <ChurchMark church={church} />
                  <span>
                    <span className="strong small" style={{ display: 'block' }}>{church.name}</span>
                    <span className="row xs dim" style={{ gap: 6 }}>
                      {church.city}, {church.country}
                      {church.verified && <Verified label="Verified" size={12} />}
                    </span>
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="wrap band-tight">
        <div className="detail-grid detail-grid-raised">
          <div className="detail-main stack stack-7">
            <section className="panel panel-warm">
              <h3 style={{ marginBottom: 'var(--s-4)' }}>What you'll learn</h3>
              <ul className="outcomes">
                {course.outcomes.map((o) => (
                  <li key={o}><Check size={15} strokeWidth={2.4} />{o}</li>
                ))}
              </ul>
            </section>

            <section className="stack stack-4">
              <div className="section-head" style={{ marginBottom: 0 }}>
                <div>
                  <h2 style={{ fontSize: 'var(--text-2xl)' }}>Curriculum</h2>
                  <p className="small">
                    {plural(course.curriculum.length, 'section')} · {plural(course.lectureCount, 'lesson')} · {hours(course.totalMinutes)} of material
                  </p>
                </div>
                <button type="button" className="link small"
                  onClick={() => setOpen(open.size === course.curriculum.length ? new Set() : new Set(course.curriculum.map((_, i) => i)))}>
                  {open.size === course.curriculum.length ? 'Collapse all' : 'Expand all'}
                </button>
              </div>
              <div className="curriculum">
                {course.curriculum.map((s, i) => (
                  <Section key={s.id} section={s} open={open.has(i)} onToggle={() => toggle(i)} />
                ))}
              </div>
            </section>

            <section className="stack stack-4">
              <h2 style={{ fontSize: 'var(--text-2xl)' }}>About this course</h2>
              <div className="prose" style={{ maxWidth: '68ch' }}>
                {course.description.map((p, i) => <p key={i}>{p}</p>)}
              </div>
              <div className="grid grid-2" style={{ marginTop: 'var(--s-3)' }}>
                <div className="stack stack-3">
                  <h4>Requirements</h4>
                  <ul className="stack stack-2">
                    {course.requirements.map((r) => (
                      <li key={r} className="row small muted" style={{ gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ marginTop: 8, width: 4, height: 4, borderRadius: '50%', background: 'var(--ink-3)', flex: 'none' }} />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="stack stack-3">
                  <h4>Who it is for</h4>
                  <ul className="stack stack-2">
                    {course.audience.map((r) => (
                      <li key={r} className="row small muted" style={{ gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ marginTop: 8, width: 4, height: 4, borderRadius: '50%', background: 'var(--ink-3)', flex: 'none' }} />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {course.certificate?.awarded && (
              <section className="panel" style={{ background: 'var(--gold-50)', borderColor: 'var(--gold-100)' }}>
                <div className="row" style={{ gap: 'var(--s-4)', alignItems: 'flex-start' }}>
                  <Award size={22} color="var(--gold-700)" style={{ flex: 'none', marginTop: 2 }} />
                  <div className="stack stack-2">
                    <h4>{course.certificate.title}</h4>
                    <p className="small muted" style={{ margin: 0 }}>{course.certificate.description}</p>
                    <p className="small muted" style={{ margin: 0 }}>
                      Added to your Digital Minister Passport with a verification code.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {unlocks?.length > 0 && (
              <section className="stack stack-4">
                <div>
                  <h2 style={{ fontSize: 'var(--text-2xl)' }}>Credentials this course counts toward</h2>
                  <p className="small muted">
                    {plural(unlocks.length, 'credential')} name this course as a requirement. Completing it satisfies
                    that requirement; the issuing church still decides the application.
                  </p>
                </div>
                <div className="grid grid-2">
                  {unlocks.map((u) => (
                    <Link key={u.slug} to={`/listing/${u.slug}`} className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--s-4)', padding: 'var(--s-3)' }}>
                      <span className="media" style={{ width: 84, aspectRatio: '3/2', flex: 'none' }}>
                        <img src={u.coverImage} alt="" loading="lazy" />
                      </span>
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span className="small strong clamp-1" style={{ display: 'block' }}>{u.title}</span>
                        <span className="xs dim">{u.award?.title ?? u.outcome}</span>
                      </span>
                      <span className="price-big" style={{ flex: 'none' }}>{money(u.price)}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className="stack stack-5">
              <h2 style={{ fontSize: 'var(--text-2xl)' }}>{plural(instructors.length, 'Instructor')}</h2>
              {instructors.map((t) => (
                <div key={t.slug} className="instructor">
                  <img className="avatar" src={t.image} alt="" width={96} height={96} style={{ width: 96, height: 96 }} loading="lazy" />
                  <div className="stack stack-2">
                    <div>
                      <h4>{t.name}</h4>
                      <p className="small dim" style={{ margin: 0 }}>{t.title}</p>
                    </div>
                    <div className="row-wrap small muted" style={{ gap: 'var(--s-4)' }}>
                      <span className="row" style={{ gap: 5 }}><Stars rating={t.rating} size={13} showNumber /> rating</span>
                      <span className="row" style={{ gap: 5 }}><Users size={13} />{compact(t.learners)} learners</span>
                      <span className="row" style={{ gap: 5 }}><GraduationCap size={13} />{t.yearsExperience} years</span>
                    </div>
                    <p className="small muted" style={{ margin: 0, maxWidth: '64ch' }}>{t.bio}</p>
                    <div className="row-wrap" style={{ gap: 6 }}>
                      {t.credentials.map((c) => <span key={c} className="tag">{c}</span>)}
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <section className="stack stack-5">
              <h2 style={{ fontSize: 'var(--text-2xl)' }}>Learner reviews</h2>
              <div className="review-summary panel panel-warm">
                <div className="review-big stack stack-2">
                  <span className="n">{course.rating.toFixed(1)}</span>
                  <Stars rating={course.rating} showNumber={false} size={16} />
                  <span className="xs dim num">{compact(course.ratingCount)} ratings</span>
                </div>
                <div className="stack stack-2">
                  {reviewBreakdown.map((b) => (
                    <div key={b.stars} className="bar-row">
                      <span className="num" style={{ width: 34 }}>{b.stars} star</span>
                      <span className="bar"><span style={{ width: `${(b.count / totalReviews) * 100}%` }} /></span>
                      <span className="num" style={{ width: 28, textAlign: 'right' }}>{b.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                {(showAllReviews ? reviews : reviews.slice(0, 4)).map((r) => (
                  <article key={r._id} className="review">
                    <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'flex-start' }}>
                      <Avatar src={r.authorAvatar} name={r.authorName} size={40} />
                      <div className="grow stack stack-2">
                        <div>
                          <span className="strong small">{r.authorName}</span>
                          <span className="xs dim"> · {r.authorLocation}</span>
                        </div>
                        <div className="row" style={{ gap: 10 }}>
                          <Stars rating={r.rating} showNumber={false} size={13} />
                          <span className="xs dim">{monthsAgo(r.monthsAgo)}</span>
                        </div>
                        <h5>{r.title}</h5>
                        <p className="small muted" style={{ margin: 0, maxWidth: '68ch' }}>{r.body}</p>
                        <span className="xs dim">{r.helpful} people found this helpful</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {reviews.length > 4 && (
                <button type="button" className="btn btn-outline" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAllReviews((v) => !v)}>
                  {showAllReviews ? 'Show fewer reviews' : `Show all ${reviews.length} reviews`}
                </button>
              )}
            </section>
          </div>

          <aside>
            <div className="buy-card">
              <div className="media media-3x2">
                <img src={course.coverImage} alt={course.coverAlt} width={800} height={534} />
              </div>
              <div className="buy-body">
                <Price amount={course.price} was={course.compareAtPrice} currency={course.currency} size="var(--text-2xl)" />
                {course.compareAtPrice > course.price && (
                  <span className="tag tag-red" style={{ alignSelf: 'flex-start' }}>
                    Save {Math.round((1 - course.price / course.compareAtPrice) * 100)}%
                  </span>
                )}

                {owned ? (
                  <Link to={`/learn/${course.slug}`} className="btn btn-primary btn-lg btn-block">
                    <PlayCircle size={18} /> Continue
                  </Link>
                ) : primary ? (
                  <div className="stack stack-3">
                    <Link to={`/listing/${primary.slug}`} className="btn btn-primary btn-lg btn-block">
                      Get {primary.award?.title ?? primary.title}
                    </Link>
                    <p className="xs dim" style={{ margin: 0 }}>
                      Included with that credential.
                    </p>
                  </div>
                ) : inCart ? (
                  <Link to="/cart" className="btn btn-primary btn-lg btn-block">
                    In your basket <ArrowRight size={17} />
                  </Link>
                ) : (
                  <div className="stack stack-3">
                    <button type="button" className="btn btn-primary btn-lg btn-block" onClick={buy}>
                      Enrol now
                    </button>
                    <button type="button" className="btn btn-outline btn-block"
                      onClick={() => add({ kind: 'course', slug: course.slug })}>
                      <ShoppingBag size={16} /> Add to basket
                    </button>
                  </div>
                )}

                <div className="stack stack-3" style={{ paddingTop: 'var(--s-2)', borderTop: '1px solid var(--line)' }}>
                  <h5>This course includes</h5>
                  <ul className="buy-includes">
                    <li><Clock size={15} />{hours(course.totalMinutes)} of material</li>
                    <li><BookOpen size={15} />{plural(course.lectureCount, 'lesson')} across {plural(course.curriculum.length, 'section')}</li>
                    <li><FileText size={15} />{plural(course.articleCount, 'written lesson')} and {plural(course.resourceCount, 'downloadable resource')}</li>
                    {course.quizCount > 0 && <li><Sparkles size={15} />{plural(course.quizCount, 'assessed quiz', 'assessed quizzes')}</li>}
                    <li><Headphones size={15} />Audio versions for low-bandwidth access</li>
                    <li><InfinityIcon size={15} />Lifetime access</li>
                    {course.certificate?.awarded && <li><Award size={15} />{course.certificate.kind} issued by {church?.shortName ?? church?.name}</li>}
                  </ul>
                </div>

                <div className="notice">
                  <Signal size={15} />
                  <span>Optimised for slow connections. Every lesson has an audio version.</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

    </>
  );
};
