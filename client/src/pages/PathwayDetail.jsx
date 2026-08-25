import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Award, BookOpen, Check, ClipboardCheck, FileCheck2, GraduationCap, MessagesSquare, ShoppingBag, Users,
} from 'lucide-react';

import { Breadcrumbs, ErrorState, Monogram, Price, Spinner, Stars, Verified } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { useAuth } from '../lib/auth.jsx';
import { useCart } from '../lib/cart.jsx';
import { compact, duration, money, plural } from '../lib/format.js';

const STEP_ICON = {
  course: BookOpen,
  review: FileCheck2,
  exam: ClipboardCheck,
  practicum: GraduationCap,
  interview: MessagesSquare,
};

const STEP_LABEL = {
  course: 'Taught course',
  review: 'Credential review',
  exam: 'Examination',
  practicum: 'Supervised practicum',
  interview: 'Board interview',
};

export const PathwayDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(`/pathways/${slug}`);
  const { has, add } = useCart();
  const { user } = useAuth();
  const { data: entitlements } = useApi('/me/entitlements', { skip: !user });

  if (loading) return <div className="wrap band"><Spinner label="Loading pathway" /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const { pathway, church, courses, separatePrice, savings } = data;
  const owned = entitlements?.pathways.some((p) => p.slug === pathway.slug);
  const inCart = has('pathway', pathway.slug);

  return (
    <>
      <div className="detail-head">
        <div className="wrap stack stack-4">
          <Breadcrumbs trail={[{ label: 'Pathways', to: '/pathways' }, { label: pathway.title }]} />
          <div className="stack stack-4" style={{ maxWidth: '70ch' }}>
            <div className="row-wrap">
              <span className="tag tag-green"><Award size={12} />{pathway.category} pathway</span>
              <span className="tag">{pathway.level}</span>
              <span className="tag">about {pathway.months} months</span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.9rem, 3.4vw, 2.75rem)' }}>{pathway.title}</h1>
            <p className="lede">{pathway.subtitle}</p>
            <div className="row-wrap" style={{ gap: 'var(--s-4)' }}>
              <Stars rating={pathway.rating} count={pathway.ratingCount} size={15} />
              <span className="row small muted" style={{ gap: 6 }}><Users size={14} />{compact(pathway.learners)} enrolled</span>
            </div>
            {church && (
              <Link to={`/churches/${church.slug}`} className="row" style={{ gap: 12 }}>
                <Monogram text={church.monogram} />
                <span>
                  <span className="strong small" style={{ display: 'block' }}>Issued by {church.name}</span>
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

      <div className="wrap band-tight">
        <div className="detail-grid">
          <div className="detail-main stack stack-7">
            <section className="stack stack-4">
              <div className="prose" style={{ maxWidth: '68ch' }}>
                {pathway.description.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </section>

            <section className="stack stack-5">
              <div>
                <h2 style={{ fontSize: 'var(--text-2xl)' }}>The stages</h2>
                <p className="small muted">{plural(pathway.steps.length, 'stage')} from enrolment to the issued credential.</p>
              </div>
              <div className="stages">
                {pathway.steps.map((step, i) => {
                  const Icon = STEP_ICON[step.kind] ?? BookOpen;
                  const course = step.courseSlug ? courses[step.courseSlug] : null;
                  const last = i === pathway.steps.length - 1;
                  return (
                    <div key={step.order} className="stage">
                      <div className="stage-rail">
                        <span className={`stage-n ${step.kind === 'course' ? '' : 'alt'}`}>{step.order}</span>
                        {!last && <span className="stage-line" />}
                      </div>
                      <div className="stage-body stack stack-3">
                        <div className="row-wrap" style={{ gap: 8 }}>
                          <span className="tag"><Icon size={12} />{STEP_LABEL[step.kind] ?? step.kind}</span>
                          {!step.required && <span className="tag">Optional</span>}
                          {step.weeks && <span className="xs dim">about {plural(step.weeks, 'week')}</span>}
                        </div>
                        <h4>{step.title}</h4>
                        <p className="small muted" style={{ margin: 0, maxWidth: '62ch' }}>{step.description}</p>
                        {course && (
                          <Link to={`/courses/${course.slug}`} className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--s-4)', padding: 'var(--s-3)', maxWidth: 560 }}>
                            <span className="media" style={{ width: 76, aspectRatio: '3/2', flex: 'none' }}>
                              <img src={course.coverImage} alt="" loading="lazy" />
                            </span>
                            <span className="grow">
                              <span className="small strong clamp-1" style={{ display: 'block' }}>{course.title}</span>
                              <span className="xs dim">{plural(course.lectureCount, 'lesson')} · {duration(course.totalMinutes)} · included</span>
                            </span>
                            <span className="price-was" style={{ flex: 'none' }}>{money(course.price)}</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="grid grid-2">
              <div className="stack stack-3">
                <h4>Eligibility</h4>
                <ul className="stack stack-2">
                  {pathway.eligibility.map((e) => (
                    <li key={e} className="row small muted" style={{ gap: 10, alignItems: 'flex-start' }}>
                      <Check size={15} strokeWidth={2.4} style={{ marginTop: 3, flex: 'none', color: 'var(--green-600)' }} />{e}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="stack stack-3">
                <h4>What you come away with</h4>
                <ul className="stack stack-2">
                  {pathway.outcomes.map((e) => (
                    <li key={e} className="row small muted" style={{ gap: 10, alignItems: 'flex-start' }}>
                      <Check size={15} strokeWidth={2.4} style={{ marginTop: 3, flex: 'none', color: 'var(--green-600)' }} />{e}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="panel" style={{ background: 'var(--gold-50)', borderColor: 'var(--gold-100)' }}>
              <div className="row" style={{ gap: 'var(--s-4)', alignItems: 'flex-start' }}>
                <Award size={22} color="var(--gold-700)" style={{ flex: 'none', marginTop: 2 }} />
                <div className="stack stack-2">
                  <span className="eyebrow" style={{ color: 'var(--gold-700)' }}>The award</span>
                  <h4>{pathway.award.title}</h4>
                  <p className="small muted" style={{ margin: 0 }}>{pathway.award.description}</p>
                </div>
              </div>
            </section>
          </div>

          <aside>
            <div className="buy-card">
              <div className="media media-3x2">
                <img src={pathway.coverImage} alt={pathway.coverAlt} width={800} height={534} />
              </div>
              <div className="buy-body">
                <Price amount={pathway.price} was={pathway.compareAtPrice} size="var(--text-2xl)" />
                {savings > 0 && (
                  <div className="notice notice-green">
                    <Check size={15} />
                    <span>
                      The taught courses cost {money(separatePrice)} bought separately. This pathway saves {money(savings)} and
                      includes every assessment stage.
                    </span>
                  </div>
                )}

                {owned ? (
                  <Link to="/dashboard" className="btn btn-primary btn-lg btn-block">Go to my learning</Link>
                ) : (
                  <div className="stack stack-3">
                    <button type="button" className="btn btn-primary btn-lg btn-block"
                      onClick={() => { if (!inCart) add({ kind: 'pathway', slug: pathway.slug }); navigate('/cart'); }}>
                      {inCart ? 'Go to basket' : 'Enrol on this pathway'}
                    </button>
                    <button type="button" className="btn btn-outline btn-block" disabled={inCart}
                      onClick={() => add({ kind: 'pathway', slug: pathway.slug })}>
                      <ShoppingBag size={16} /> {inCart ? 'In your basket' : 'Add to basket'}
                    </button>
                  </div>
                )}

                <div className="stack stack-3" style={{ paddingTop: 'var(--s-2)', borderTop: '1px solid var(--line)' }}>
                  <h5>Included</h5>
                  <ul className="buy-includes">
                    <li><BookOpen size={15} />{plural(pathway.steps.filter((s) => s.kind === 'course').length, 'full course')}, unlocked immediately</li>
                    <li><ClipboardCheck size={15} />{plural(pathway.steps.filter((s) => s.kind !== 'course').length, 'assessment stage')}</li>
                    <li><Award size={15} />{pathway.award.title} on completion</li>
                    <li><GraduationCap size={15} />Recorded in your Minister Passport</li>
                  </ul>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
};
