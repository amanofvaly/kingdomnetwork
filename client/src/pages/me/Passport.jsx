import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Award, BadgeCheck, Check, Clock, Copy, Download, Plane, ShieldCheck,
} from 'lucide-react';

import { AreaHero, PassportBook, Section, SectionHead, ZeroState } from '../../components/me/kit.jsx';
import { StatusTag } from '../../components/me/application.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { dateLong, plural } from '../../lib/format.js';
import { getToken } from '../../lib/api.js';
import { useApi } from '../../lib/useAsync.js';
import { useAuth } from '../../lib/auth.jsx';

/**
 * What this person holds, drawn as documents rather than as rows.
 *
 * A credential is the thing they went and earned; a table would be a poor way
 * to hand it back to them. An empty passport shows its blank pages instead of
 * an apology.
 */

const KIND = {
  certificate: 'Certificate',
  ordination: 'Ordination',
  license: 'Licence',
  diploma: 'Diploma',
  'letter-of-standing': 'Letter of standing',
  affiliation: 'Affiliation',
  'invitation-letter': 'Invitation letter',
};

/** The bearer token has to ride along, so the PDF comes back as a blob. */
const download = async (c, mark) => {
  mark('working');
  try {
    const res = await fetch(`/api/me/credentials/${c.credentialId}/document.pdf`, {
      headers: { authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return mark('failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(c.title ?? 'document').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${c.credentialId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return mark('done');
  } catch {
    return mark('failed');
  }
};

const CredentialCard = ({ credential: c, i }) => {
  const [state, setState] = useState('idle');
  const [copied, setCopied] = useState(false);
  const live = c.status === 'issued' && !c.expired;
  const isLetter = c.kind === 'invitation-letter';

  const copy = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/verify/${c.verifyCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <article className={`me-cred ${live ? '' : 'me-cred-lapsed'}`} style={{ '--i': i }}>
      <div className="me-cred-in">
        <div className="row-between">
          <span className="tag">
            {isLetter ? <Plane size={12} /> : <Award size={12} />} {KIND[c.kind] ?? c.kind}
          </span>
          {live
            ? <span className="tag tag-green">Issued</span>
            : <span className={`tag ${c.status === 'revoked' ? 'tag-red' : 'tag-gold'}`}>
              {c.status === 'revoked' ? 'Withdrawn' : 'Expired'}
            </span>}
        </div>

        <div className="stack stack-2">
          <h3 style={{ fontSize: 'var(--text-lg)', letterSpacing: '-.02em' }}>{c.title}</h3>
          {c.church ? (
            <Link to={`/churches/${c.church.slug}`} className="row small muted" style={{ gap: 8 }}>
              <span className="monogram monogram-sm">{c.church.monogram}</span>
              <span className="grow clamp-1">
                {c.church.name}
                {c.church.verified ? (
                  <BadgeCheck size={12} style={{ display: 'inline', marginLeft: 4, verticalAlign: '-2px', color: 'var(--green-600)' }} />
                ) : null}
              </span>
            </Link>
          ) : null}
        </div>

        {c.renewalDueInDays != null && c.renewalDueInDays <= 90 && live ? (
          <div className="notice notice-gold">
            <Clock size={15} />
            <span>
              {c.renewalDueInDays > 0
                ? `Renewal is due in ${plural(c.renewalDueInDays, 'day')}.`
                : 'Renewal is overdue.'}{' '}
              {c.church ? <Link className="link" to={`/churches/${c.church.slug}`}>Speak to {c.church.shortName ?? c.church.name}</Link> : null}
            </span>
          </div>
        ) : null}

        <div className="stack stack-2" style={{ paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' }}>
          <div className="row-between xs"><span className="dim">Credential</span><span className="me-cred-code">{c.credentialId}</span></div>
          <div className="row-between xs"><span className="dim">Issued</span><span>{dateLong(c.issuedAt)}</span></div>
          {c.expiresAt ? <div className="row-between xs"><span className="dim">Valid until</span><span>{dateLong(c.expiresAt)}</span></div> : null}
          <div className="row-between xs"><span className="dim">Verify code</span><span className="me-cred-code">{c.verifyCode}</span></div>
        </div>

        {live ? (
          <div className="row-wrap" style={{ gap: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={state === 'working'}
              onClick={() => download(c, setState)}>
              <Download size={14} /> {state === 'working' ? 'Preparing…' : state === 'failed' ? 'Try again' : 'Download PDF'}
            </button>
            <Link to={`/verify/${c.verifyCode}`} className="btn btn-outline btn-sm">
              <ShieldCheck size={14} /> Verify page
            </Link>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy link</>}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
};

export const MePassport = () => {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi('/me/passport');

  if (loading) return <div className="me-wrap me-body"><Spinner /></div>;
  if (error) return <div className="me-wrap me-body"><ErrorState error={error} onRetry={reload} /></div>;

  const { credentials, applications, counts } = data;
  const live = credentials.filter((c) => c.status === 'issued' && !c.expired);
  const lapsed = credentials.filter((c) => c.expired || c.status === 'expired' || c.status === 'revoked');
  const renewals = live.filter((c) => c.renewalDueInDays != null && c.renewalDueInDays <= 90);

  const figures = [
    { value: counts.issued, label: 'held' },
    { value: counts.inProgress, label: 'in progress' },
    { value: counts.letters, label: 'letters' },
    { value: counts.expired, label: 'lapsed' },
  ].filter((f) => f.value > 0);

  return (
    <>
      <AreaHero
        art="/media/church-registration-cross.jpg"
        artAlt="A cross lit in blue, gold and red"
        kicker="Minister passport"
        title={counts.issued ? `${plural(counts.issued, 'document')} in your name.` : 'Your passport, unstamped.'}
        lede={counts.issued
          ? 'Each of these is downloadable, and anyone you show it to can check it against this network.'
          : 'Every credential a church issues you lands here — downloadable, and verifiable by anyone you show it to.'}
        figures={figures}
      />

      <div className="me-wrap me-body">
        <Section tone="passport">
          <PassportBook
            holder={data.holder?.name ?? user.name}
            role={user.ministryRole || (counts.issued ? 'Standing held on this network' : 'No standing recorded yet')}
            slots={Math.max(4, live.length)}
            stamps={live.slice(0, 8).map((c) => ({
              key: c.credentialId,
              label: KIND[c.kind] ?? c.kind,
              title: `${c.title} — ${c.church?.name ?? ''}`,
              icon: <Award size={16} strokeWidth={1.7} />,
            }))}
          >
            {!counts.issued ? (
              <div className="row" style={{ gap: 'var(--s-3)', flexWrap: 'wrap', paddingTop: 'var(--s-2)' }}>
                <Link to="/ordination" className="btn btn-inverse">Find a credential <ArrowRight size={16} /></Link>
                <Link to="/verify" className="btn btn-inverse-outline">How verification works</Link>
              </div>
            ) : null}
          </PassportBook>
        </Section>

        {renewals.length ? (
          <Section tone="passport">
            <SectionHead title="Due for renewal" lede="Standing that lapses unless it is renewed." />
            <div className="me-grid me-grid-2 me-stagger">
              {renewals.map((c, i) => <CredentialCard key={c.credentialId} credential={c} i={i} />)}
            </div>
          </Section>
        ) : null}

        <Section tone="passport">
          <SectionHead
            title="What you hold"
            lede={live.length ? 'Current documents, with the code anyone can check them against.' : null}
          />
          {live.length ? (
            <div className="me-grid me-grid-2 me-stagger">
              {live.map((c, i) => <CredentialCard key={c.credentialId} credential={c} i={i} />)}
            </div>
          ) : (
            <ZeroState
              title="No documents yet"
              lede="A church issues these once it has read your application and is satisfied. Nothing here is bought — standing is granted."
              art="/media/scenes/graduation-caps.webp"
              action={<Link to="/ordination" className="btn btn-primary">See what churches issue <ArrowRight size={16} /></Link>}
            />
          )}
        </Section>

        {applications.length ? (
          <Section tone="journey">
            <SectionHead
              title="On its way"
              lede="Applications a church has not finished with."
              action={<Link to="/me/journey" className="link">Open your journey <ArrowRight size={14} /></Link>}
            />
            <div className="me-list me-stagger">
              {applications.map((a, i) => (
                <div key={a.reference} className="me-row" style={{ '--i': i }}>
                  {a.offering?.coverImage ? (
                    <div className="me-row-art"><img src={a.offering.coverImage} alt="" loading="lazy" /></div>
                  ) : null}
                  <div className="me-row-main">
                    <b className="clamp-1">{a.offeringTitle}</b>
                    <span className="clamp-1">{a.church?.name}</span>
                  </div>
                  <div className="me-row-end">
                    <StatusTag status={a.status} />
                    <Link to={`/applications/${a.reference}`} className="btn btn-outline btn-sm">Open</Link>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {lapsed.length ? (
          <Section tone="passport">
            <SectionHead title="No longer current" lede="Kept on the record: someone checking a document needs to be told it lapsed, not that it never existed." />
            <div className="me-grid me-grid-2 me-stagger">
              {lapsed.map((c, i) => <CredentialCard key={c.credentialId} credential={c} i={i} />)}
            </div>
          </Section>
        ) : null}
      </div>
    </>
  );
};
