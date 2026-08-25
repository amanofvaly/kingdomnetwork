import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Check, Clock, Download, Lock, MapPin, Plane, ShoppingBag, Users,
} from 'lucide-react';

import { ACQUISITION, AcquisitionTag, OfferingCard } from '../components/market.jsx';
import { Breadcrumbs, ErrorState, Spinner, Stars } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { useAuth } from '../lib/auth.jsx';
import { useCart } from '../lib/cart.jsx';
import { compact, money, plural } from '../lib/format.js';

/**
 * The document, with the buyer's name written into it. This is the pitch —
 * seeing yourself on the thing before you have paid for it.
 */
const DocumentPreview = ({ slug, type, defaultName }) => {
  const [name, setName] = useState(defaultName ?? '');
  const [applied, setApplied] = useState(defaultName ?? '');

  useEffect(() => {
    const t = setTimeout(() => setApplied(name), 500);
    return () => clearTimeout(t);
  }, [name]);

  const portrait = type === 'invitation-letter';
  const src = `/api/offerings/${slug}/preview.pdf?name=${encodeURIComponent(applied)}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;

  return (
    <div className="stack stack-3">
      <div className="doc-name">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Type your full name to see it on the document"
          aria-label="Your name, as it will appear on the document"
          maxLength={60}
        />
      </div>
      <div className={`doc-stage ${portrait ? 'portrait' : 'landscape'}`}>
        <iframe key={src} src={src} title="Document preview" loading="lazy" />
      </div>
      <p className="xs dim" style={{ margin: 0 }}>
        Watermarked until it is issued. Whatever you type above is exactly what gets printed.
      </p>
    </div>
  );
};

const Requirements = ({ requirements }) => {
  const { credentials, courses, assessment, review, eligibility } = requirements;
  const nothing = !credentials.length && !courses.length && !assessment && !review;

  if (nothing) {
    return (
      <div className="notice notice-green">
        <Check size={16} />
        <span>Nothing is required. This is issued to your passport as soon as you pay.</span>
      </div>
    );
  }

  return (
    <div className="req-list">
      {credentials.map((c) => (
        <div key={c.slug} className={`req ${c.met ? 'is-met' : ''}`}>
          <span className="req-dot">{c.met ? <Check size={13} strokeWidth={3} /> : <Lock size={12} />}</span>
          <span className="grow" style={{ minWidth: 0 }}>
            <Link to={`/listing/${c.slug}`} className="small strong clamp-1" style={{ display: 'block' }}>{c.title}</Link>
            <span className="xs dim">{c.met ? 'You already hold this' : 'Credential required'}</span>
          </span>
          {!c.met && <Link to={`/listing/${c.slug}`} className="btn btn-outline btn-sm">{money(c.price)}</Link>}
        </div>
      ))}

      {courses.map((c) => (
        <div key={c.slug} className={`req ${c.met ? 'is-met' : ''}`}>
          <span className="req-dot">{c.met ? <Check size={13} strokeWidth={3} /> : <Clock size={12} />}</span>
          <span className="grow" style={{ minWidth: 0 }}>
            <Link to={`/courses/${c.slug}`} className="small strong clamp-1" style={{ display: 'block' }}>{c.title}</Link>
            <span className="xs dim">
              {c.met ? 'Completed' : `${plural(c.lectureCount ?? 0, 'lesson')} · included when you buy this`}
            </span>
          </span>
        </div>
      ))}

      {assessment && (
        <div className="req">
          <span className="req-dot"><Check size={13} /></span>
          <span className="grow">
            <span className="small strong" style={{ display: 'block' }}>Assessment</span>
            <span className="xs dim">
              {plural(assessment.questionCount, 'question')} · {assessment.minutes} minutes · pass mark {assessment.passMark}%
            </span>
          </span>
        </div>
      )}

      {review && (
        <div className="req">
          <span className="req-dot"><Clock size={12} /></span>
          <span className="grow">
            <span className="small strong" style={{ display: 'block' }}>Review by the church</span>
            <span className="xs dim">
              About {plural(review.turnaroundDays, 'day')} · {(review.documents ?? []).join(', ')}
            </span>
          </span>
        </div>
      )}

      {eligibility.length > 0 && (
        <div className="panel panel-warm stack stack-2" style={{ padding: 'var(--s-4)' }}>
          <h5>The church also asks</h5>
          <ul className="stack stack-2">
            {eligibility.map((e) => (
              <li key={e} className="row small muted" style={{ gap: 10, alignItems: 'flex-start' }}>
                <span style={{ marginTop: 8, width: 4, height: 4, borderRadius: '50%', background: 'var(--ink-3)', flex: 'none' }} />
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export const Listing = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(`/offerings/${slug}`);
  const { user } = useAuth();
  const { add, has } = useCart();

  if (loading) return <div className="wrap band"><Spinner label="Loading listing" /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const { offering: o, church, requirements, alternatives, alsoFrom, held, outcome } = data;
  const inCart = has('offering', o.slug);
  const repeatable = o.type === 'invitation-letter';
  const alreadyHeld = held && !repeatable;
  const discount = o.compareAtPrice > o.price ? Math.round((1 - o.price / o.compareAtPrice) * 100) : 0;
  const mode = ACQUISITION[o.acquisition] ?? ACQUISITION.instant;

  const missing = [
    ...requirements.credentials.filter((c) => !c.met).map((c) => ({ kind: 'offering', slug: c.slug, price: c.price, title: c.title })),
  ];

  const buyNow = () => {
    if (!inCart) add({ kind: 'offering', slug: o.slug });
    navigate('/checkout');
  };

  return (
    <>
      <div className="detail-head">
        <div className="wrap stack stack-4">
          <Breadcrumbs trail={[
            { label: outcome?.name ?? 'Listings', to: outcome ? `/${outcome.slug}` : '/search' },
            { label: church?.shortName ?? '', to: church ? `/churches/${church.slug}` : undefined },
            { label: o.title },
          ]} />

          <div>
            <div className="stack stack-4" style={{ maxWidth: '62ch' }}>
              <div className="row-wrap" style={{ gap: 8 }}>
                {o.badge && <span className="badge-bestseller">{o.badge}</span>}
                <AcquisitionTag mode={o.acquisition} />
                {o.award?.postNominal && <span className="tag">Style: {o.award.postNominal}</span>}
              </div>

              <h1 style={{ fontSize: 'clamp(1.9rem, 3.4vw, 2.6rem)' }}>{o.title}</h1>
              <p className="lede">{o.subtitle}</p>

              <div className="row-wrap" style={{ gap: 'var(--s-4)' }}>
                <Stars rating={o.rating} count={o.ratingCount} size={15} />
                <span className="row small muted" style={{ gap: 6 }}><Users size={14} />{compact(o.issuedCount)} issued</span>
                {o.letter?.destinationCity && (
                  <span className="row small muted" style={{ gap: 6 }}><Plane size={14} />{o.letter.destinationCity}</span>
                )}
              </div>

              {church && (
                <Link to={`/churches/${church.slug}`} className="row" style={{ gap: 12 }}>
                  <span className="monogram">{church.monogram}</span>
                  <span>
                    <span className="strong small" style={{ display: 'block' }}>Issued and signed by {church.name}</span>
                    <span className="row xs dim" style={{ gap: 6 }}>
                      <MapPin size={11} />{church.city}, {church.country} · founded {church.foundedYear}
                      {church.verified && <BadgeCheck size={12} style={{ color: 'var(--green-600)' }} />}
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
            <section className="stack stack-4">
              <div>
                <h2 style={{ fontSize: 'var(--text-2xl)' }}>
                  {o.type === 'invitation-letter' ? 'The letter you receive' : 'The document you receive'}
                </h2>
                <p className="small muted">Put your name in and see exactly what gets issued.</p>
              </div>
              <DocumentPreview slug={o.slug} type={o.type} defaultName={user?.name ?? ''} />
            </section>

            <section className="stack stack-4">
              <div>
                <h2 style={{ fontSize: 'var(--text-2xl)' }}>What this church requires</h2>
                <p className="small muted">{mode.help}</p>
              </div>
              <Requirements requirements={requirements} />

              {missing.length > 0 && (
                <div className="panel panel-warm row-between" style={{ gap: 'var(--s-4)', flexWrap: 'wrap' }}>
                  <div>
                    <h5>You are missing {plural(missing.length, 'credential')}</h5>
                    <p className="small muted" style={{ margin: 0 }}>
                      Add them together and this becomes issuable as soon as each one is granted.
                    </p>
                  </div>
                  <button type="button" className="btn btn-primary"
                    onClick={() => { missing.forEach((m) => add({ kind: 'offering', slug: m.slug })); add({ kind: 'offering', slug: o.slug }); navigate('/cart'); }}>
                    Add all {money(missing.reduce((n, m) => n + m.price, 0) + o.price)}
                  </button>
                </div>
              )}
            </section>

            {o.description?.length > 0 && (
              <section className="stack stack-4">
                <h2 style={{ fontSize: 'var(--text-2xl)' }}>About this listing</h2>
                <div className="prose" style={{ maxWidth: '68ch' }}>
                  {o.description.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </section>
            )}

            {o.letter?.destinationCountry && (
              <section className="panel panel-warm stack stack-3">
                <h4 className="row" style={{ gap: 8 }}><Plane size={18} /> The visit</h4>
                <div className="grid grid-2" style={{ gap: 'var(--s-4)' }}>
                  {[
                    ['Destination', `${o.letter.destinationCity}, ${o.letter.destinationCountry}`],
                    ['Purpose', o.letter.purpose],
                    ['Letter valid for', `${o.letter.validityMonths} months from issue`],
                    ['Signed within', `about ${plural(o.letter.turnaroundDays, 'day')}`],
                  ].map(([k, v]) => (
                    <div key={k} className="stack" style={{ gap: 2 }}>
                      <span className="xs dim">{k}</span>
                      <span className="small">{v}</span>
                    </div>
                  ))}
                </div>
                {o.letter.hostCommitment && (
                  <p className="small muted" style={{ margin: 0, paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' }}>
                    {o.letter.hostCommitment}
                  </p>
                )}
              </section>
            )}

            {alternatives.length > 0 && (
              <section className="stack stack-4">
                <div>
                  <h2 style={{ fontSize: 'var(--text-2xl)' }}>The same from other churches</h2>
                  <p className="small muted">{outcome?.name} is issued by many ministries. Compare before you commit.</p>
                </div>
                <div className="grid grid-4">
                  {alternatives.map((a) => <OfferingCard key={a.slug} offering={a} />)}
                </div>
                {outcome && (
                  <Link to={`/${outcome.slug}`} className="link" style={{ alignSelf: 'flex-start' }}>
                    Compare all {outcome.name.toLowerCase()} listings <ArrowRight size={15} />
                  </Link>
                )}
              </section>
            )}
          </div>

          <aside>
            <div className="buy-card">
              <div className="media media-3x2">
                <img src={o.coverImage} alt={o.coverAlt} width={800} height={534} />
              </div>
              <div className="buy-body">
                <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
                  <span className="price-big price-xl">{money(o.price, o.currency)}</span>
                  {discount > 0 && <span className="price-was">{money(o.compareAtPrice)}</span>}
                  {discount > 0 && <span className="tag tag-red">{discount}% off</span>}
                </div>
                {o.award?.validityMonths ? (
                  <span className="xs dim">
                    Valid {o.award.validityMonths} months{o.award.renewable ? ', renewable' : ''}
                  </span>
                ) : (
                  <span className="xs dim">Held for life</span>
                )}

                {alreadyHeld ? (
                  <Link to="/passport" className="btn btn-primary btn-lg btn-block">
                    <Download size={17} /> In your passport
                  </Link>
                ) : (
                  <div className="stack stack-3">
                    <button type="button" className="btn btn-primary btn-lg btn-block" onClick={buyNow}>
                      Buy now
                    </button>
                    <button type="button" className="btn btn-outline btn-block" disabled={inCart}
                      onClick={() => add({ kind: 'offering', slug: o.slug })}>
                      <ShoppingBag size={16} /> {inCart ? 'In your basket' : 'Add to basket'}
                    </button>
                    {repeatable && held && (
                      <p className="xs dim" style={{ margin: 0 }}>
                        You have been issued this letter before. Buying again issues a new one for a new trip.
                      </p>
                    )}
                  </div>
                )}

                <div className="stack stack-3" style={{ paddingTop: 'var(--s-2)', borderTop: '1px solid var(--line)' }}>
                  <h5>What you get</h5>
                  <ul className="buy-includes">
                    <li><Download size={15} />{o.award?.documentTitle ?? 'Signed document'} as a PDF</li>
                    <li><BadgeCheck size={15} />Recorded in your Minister Passport</li>
                    <li><Check size={15} />A verification code anyone can check</li>
                    <li><mode.icon size={15} />{mode.label}</li>
                    {requirements.courses.length > 0 && (
                      <li><Clock size={15} />{plural(requirements.courses.length, 'course')} unlocked when you pay</li>
                    )}
                  </ul>
                </div>

                <div className="notice">
                  <span>
                    {church?.name} sets the requirements and signs this document. Kingdom Network records it and
                    makes it verifiable.
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* On a phone the buy column is static and sits below a long page, so the
          purchase stays reachable in a fixed bar instead. */}
      <div className="buy-bar" role="region" aria-label="Purchase">
        <div className="buy-bar-price">
          <span className="price-big">{money(o.price, o.currency)}</span>
          {discount > 0 && <span className="price-was">{money(o.compareAtPrice)}</span>}
          {discount > 0 && <span className="tag tag-red">{discount}% off</span>}
        </div>
        {alreadyHeld ? (
          <Link to="/passport" className="btn btn-outline btn-block">
            <Download size={16} /> In your passport
          </Link>
        ) : (
          <div className="buy-bar-actions">
            <button type="button" className="btn btn-outline buy-bar-add" aria-label="Add to basket"
              disabled={inCart} onClick={() => add({ kind: 'offering', slug: o.slug })}>
              <ShoppingBag size={17} />
            </button>
            <button type="button" className="btn btn-primary btn-block" onClick={buyNow}>Buy now</button>
          </div>
        )}
      </div>

      {alsoFrom.length > 0 && (
        <section className="band band-tight band-sunken">
          <div className="wrap stack stack-4">
            <div className="rail-head">
              <div>
                <h2 style={{ fontSize: 'var(--text-2xl)' }}>Also from {church?.shortName ?? church?.name}</h2>
                <p className="small muted" style={{ margin: '4px 0 0' }}>Everything else this ministry issues.</p>
              </div>
              <Link to={`/churches/${church?.slug}`} className="link">Church profile <ArrowRight size={15} /></Link>
            </div>
            <div className="grid grid-4">
              {alsoFrom.map((a) => <OfferingCard key={a.slug} offering={a} showOutcome />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
};
