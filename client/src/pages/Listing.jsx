import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Check, Download, MapPin, Plane, ShieldCheck, Users,
} from 'lucide-react';

import { ACQUISITION, AcquisitionTag, OfferingCard, confersStanding } from '../components/market.jsx';
import { Breadcrumbs, ErrorState, Spinner, Stars } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { useAuth } from '../lib/auth.jsx';
import { compact, money, plural } from '../lib/format.js';

/**
 * One thing a church issues: what it is, what it asks of you, and what the
 * document says.
 *
 * There is no basket here and no "buy now". A title is not bought, and the
 * page has to say so in the way it behaves, not only in the words on it.
 */

/** The document, with your name written into it, before you have applied. */
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
          placeholder="Enter your full name"
          aria-label="Your full name, as it will appear on the certificate"
          maxLength={60}
        />
      </div>
      <div className={`doc-stage ${portrait ? 'portrait' : 'landscape'}`}>
        <iframe key={src} src={src} title="Document preview" loading="lazy" />
      </div>
      <p className="xs dim" style={{ margin: 0 }}>
        Sample only. Watermarked until issued.
      </p>
    </div>
  );
};

/**
 * The checklist, resolved against whoever is reading it — so a signed-in
 * minister sees which requirements they already meet.
 */
const Requirements = ({ requirements, signedIn }) => {
  const steps = (requirements?.steps ?? []).filter((s) => s.type !== 'fee');
  const eligibility = requirements?.eligibility ?? [];

  if (!steps.length && !eligibility.length) {
    return (
      <div className="notice">
        <span>This church only requires your details.</span>
      </div>
    );
  }

  return (
    <div className="stack stack-4">
      <div className="checklist">
        {steps.map((s) => {
          const met = signedIn && s.status === 'complete';
          return (
            <div key={s.key} className={`check-step ${met ? 'is-complete' : ''}`}>
              <span className="mark">{met ? <Check size={12} strokeWidth={3} /> : null}</span>
              <span className="body">
                <span className="label">{s.course?.title ?? s.offering?.title ?? s.label}</span>
                {s.detail ? <span className="detail">{s.detail}</span> : null}
                {s.options?.length ? (
                  <span className="detail">{s.options.map((o) => o.title ?? o.slug).join(' · ')}</span>
                ) : null}
              </span>
              {s.offering && !met ? (
                <Link className="btn btn-ghost btn-sm" to={`/listing/${s.offering.slug}`}>
                  {s.offering.fee?.amount ? money(s.offering.fee.amount) : 'View'}
                </Link>
              ) : null}
              {s.course && !met ? (
                <Link className="btn btn-ghost btn-sm" to={`/courses/${s.course.slug}`}>View</Link>
              ) : null}
            </div>
          );
        })}
      </div>

      {eligibility.length > 0 && (
        <div className="panel panel-warm stack stack-2" style={{ padding: 'var(--s-4)' }}>
          <h5>Additional requirements</h5>
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

/**
 * One button, three states: you hold it, you have applied, or you may apply.
 * Declared out here so React keeps it as one component type across renders.
 */
const Action = ({ offering: o, held, application, size = '' }) => {
  const fee = o.fee?.amount ?? o.price ?? 0;

  if (held) {
    return (
      <Link to="/me/passport" className={`btn btn-primary btn-block ${size}`}>
        <Download size={17} /> In your passport
      </Link>
    );
  }
  if (application) {
    return (
      <Link to={`/applications/${application.reference}`} className={`btn btn-primary btn-block ${size}`}>
        Your application <ArrowRight size={17} />
      </Link>
    );
  }
  return (
    <Link to={`/apply/${o.slug}`} className={`btn btn-primary btn-block ${size}`}>
      {fee > 0 ? `Apply — ${money(fee, o.currency)}` : 'Apply'}
    </Link>
  );
};

export const Listing = () => {
  const { slug } = useParams();
  const { data, error, loading, reload } = useApi(`/offerings/${slug}`);
  const { user } = useAuth();

  if (loading) return <div className="wrap band"><Spinner label="Loading listing" /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const { offering: o, church, requirements, alternatives, alsoFrom, held, application, outcome, disclosures } = data;

  const repeatable = o.type === 'invitation-letter';
  const alreadyHeld = held && !repeatable;
  const mode = ACQUISITION[o.acquisition] ?? ACQUISITION.application;
  const fee = o.fee?.amount ?? o.price ?? 0;
  const standing = confersStanding(o.type);

  return (
    <>
      <div className="detail-head">
        <div className="wrap stack stack-4">
          <Breadcrumbs trail={[
            { label: outcome?.name ?? 'Listings', to: outcome ? `/${outcome.slug}` : '/search' },
            { label: church?.shortName ?? '', to: church ? `/churches/${church.slug}` : undefined },
            { label: o.title },
          ]} />

          <div className="stack stack-4" style={{ maxWidth: '62ch' }}>
            <div className="row-wrap" style={{ gap: 8 }}>
              {!standing && o.badge ? <span className="badge-bestseller">{o.badge}</span> : null}
              <AcquisitionTag mode={o.acquisition} />
              {o.award?.postNominal && <span className="tag">Style: {o.award.postNominal}</span>}
              {o.tier && o.tier !== 'other' ? <span className="tag">{o.tier}</span> : null}
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
                    <MapPin size={11} />{church.city}, {church.country}
                    {church.foundedYear ? ` · founded ${church.foundedYear}` : ''}
                    {church.verified && <BadgeCheck size={12} style={{ color: 'var(--blue-600)' }} />}
                  </span>
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="wrap band-tight">
        <div className="detail-grid detail-grid-raised">
          <div className="detail-main stack stack-7">
            <section className="stack stack-4">
              <div>
                <h2 style={{ fontSize: 'var(--text-2xl)' }}>Requirements</h2>
                <p className="small muted">{mode.help}</p>
              </div>
              <Requirements requirements={requirements} signedIn={Boolean(user)} />
            </section>

            <section className="stack stack-4">
              <div>
                <h2 style={{ fontSize: 'var(--text-2xl)' }}>
                  {o.type === 'invitation-letter' ? 'Letter preview' : 'Certificate preview'}
                </h2>
                <p className="small muted">
                  This is a specimen of what the church may issue after you meet every requirement and it approves your application.
                </p>
              </div>
              <DocumentPreview slug={o.slug} type={o.type} defaultName={user?.name ?? ''} />
            </section>

            {o.description?.length > 0 && (
              <section className="stack stack-4">
                <h2 style={{ fontSize: 'var(--text-2xl)' }}>Description</h2>
                <div className="prose" style={{ maxWidth: '68ch' }}>
                  {o.description.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </section>
            )}

            {o.letter?.destinationCountry && (
              <section className="panel panel-warm stack stack-3">
                <h4 className="row" style={{ gap: 8 }}><Plane size={18} /> Travel details</h4>
                <div className="grid grid-2" style={{ gap: 'var(--s-4)' }}>
                  {[
                    ['Destination', [o.letter.destinationCity, o.letter.destinationCountry].filter(Boolean).join(', ')],
                    ['Purpose', o.letter.purpose],
                    o.letter.validityMonths && ['Letter valid for', `${o.letter.validityMonths} months from issue`],
                    o.letter.turnaroundDays && ['Signed within', `about ${plural(o.letter.turnaroundDays, 'day')}`],
                  ].filter(Boolean).map(([k, v]) => (
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

            {/* Stated in the place the claim is made, every time. */}
            <section className="stack stack-3">
              <h2 style={{ fontSize: 'var(--text-2xl)' }} className="row">
                <ShieldCheck size={20} strokeWidth={1.8} /> Important information
              </h2>
              <div className="prose small muted" style={{ maxWidth: '68ch' }}>
                {(disclosures ?? []).map((d, i) => <p key={i}>{d}</p>)}
              </div>
            </section>

            {alternatives.length > 0 && (
              <section className="stack stack-4">
                <div>
                  <h2 style={{ fontSize: 'var(--text-2xl)' }}>Similar credentials from other churches</h2>
                  <p className="small muted">
                    {outcome?.name} is offered by several churches. Compare their requirements and fees.
                  </p>
                </div>
                <div className="grid grid-3">
                  {alternatives.map((a) => <OfferingCard key={a.slug} offering={a} />)}
                </div>
                {outcome && (
                  <Link to={`/${outcome.slug}`} className="link" style={{ alignSelf: 'flex-start' }}>
                    View all {outcome.name.toLowerCase()} listings <ArrowRight size={15} />
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
                <div className="stack" style={{ gap: 2 }}>
                  <span className="price-big price-xl">{fee > 0 ? money(fee, o.currency) : 'No fee'}</span>
                  <span className="xs dim">
                    {fee > 0 ? `${o.fee?.label ?? 'Application fee'}, paid when you apply` : 'No fee to apply'}
                  </span>
                </div>

                <span className="xs dim">
                  {o.award?.validityMonths
                    ? `Valid ${o.award.validityMonths} months${o.award.renewable ? ', renewable' : ''}`
                    : 'Held for life'}
                </span>

                <Action offering={o} held={alreadyHeld} application={application} size="btn-lg" />

                {repeatable && held ? (
                  <p className="xs dim" style={{ margin: 0 }}>
                    You have been issued this letter before. Apply again for a new one.
                  </p>
                ) : null}

                <div className="stack stack-3" style={{ paddingTop: 'var(--s-2)', borderTop: '1px solid var(--line)' }}>
                  <h5>If the church approves</h5>
                  <ul className="buy-includes">
                    <li><Download size={15} />The church issues {o.award?.documentTitle ?? 'a signed document'} as a PDF</li>
                    <li><BadgeCheck size={15} />The issued record appears in your Minister Passport</li>
                    <li><Check size={15} />The issued document receives a verification code</li>
                  </ul>
                </div>

                {fee > 0 ? (
                  <div className="notice">
                    <span>
                      Covers {church?.shortName ?? 'this church'}'s assessment of your application. It does not
                      guarantee the credential, and the church may still decline.
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* On a phone the side column sits below a long page, so the action stays
          reachable in a fixed bar instead. */}
      <div className="buy-bar" role="region" aria-label="Apply">
        <div className="buy-bar-price">
          <span className="price-big">{fee > 0 ? money(fee, o.currency) : 'No fee'}</span>
          <span className="xs dim">{fee > 0 ? 'to apply' : ''}</span>
        </div>
        <Action offering={o} held={alreadyHeld} application={application} />
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
            <div className="grid grid-3">
              {alsoFrom.map((a) => <OfferingCard key={a.slug} offering={a} showOutcome />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
};
