import { Link } from 'react-router-dom';
import {
  Award, BadgeCheck, Clock, Copy, Download, FileCheck2, IdCard, Plane, ShieldCheck,
} from 'lucide-react';

import { Avatar, Empty, ErrorState, Spinner } from '../components/ui.jsx';
import { getToken } from '../lib/api.js';
import { useApi } from '../lib/useAsync.js';
import { dateLong, money, plural } from '../lib/format.js';

const KIND = {
  certificate: 'Certificate',
  ordination: 'Ordination',
  license: 'Licence',
  affiliation: 'Affiliation',
  'invitation-letter': 'Invitation letter',
};

const STATUS = {
  issued: { label: 'Issued', tone: 'tag-green' },
  'in-review': { label: 'With the church', tone: 'tag-gold' },
  'in-progress': { label: 'Not yet issued', tone: '' },
  revoked: { label: 'Withdrawn', tone: 'tag-red' },
};

/**
 * Downloads go through fetch so the bearer token is attached, then the blob is
 * handed to the browser.
 */
const download = async (credential) => {
  const res = await fetch(`/api/me/credentials/${credential.credentialId}/document.pdf`, {
    headers: { authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${credential.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${credential.credentialId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const Blockers = ({ blockers }) => (
  <div className="stack stack-2" style={{ paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' }}>
    <span className="xs dim">Waiting on</span>
    {blockers.map((b, i) => {
      if (b.kind === 'assessment') {
        return <span key={i} className="row small" style={{ gap: 8 }}><FileCheck2 size={14} /> The assessment</span>;
      }
      if (b.kind === 'course') {
        return (
          <div key={i} className="stack stack-1">
            <Link to={`/learn/${b.slug}`} className="row small" style={{ gap: 8 }}>
              <Clock size={14} /> <span className="grow clamp-1">{b.course?.title ?? b.slug}</span>
              <span className="xs dim num">{b.progress}%</span>
            </Link>
            <div className="progress"><span style={{ width: `${b.progress}%` }} /></div>
          </div>
        );
      }
      return (
        <Link key={i} to={`/listing/${b.slug}`} className="row small" style={{ gap: 8 }}>
          <Award size={14} /> <span className="grow clamp-1">{b.offering?.title ?? b.slug}</span>
          {b.offering && <span className="xs dim">{money(b.offering.price)}</span>}
        </Link>
      );
    })}
  </div>
);

const CredentialCard = ({ credential: c }) => {
  const issued = c.status === 'issued';
  const isLetter = c.kind === 'invitation-letter';
  const status = STATUS[c.status] ?? STATUS['in-progress'];

  return (
    <article className={`cred ${issued ? 'issued' : ''} ${isLetter ? 'letter' : ''}`}>
      {issued && <span className="cred-seal" aria-hidden="true" />}

      <div className="row-between">
        <span className="tag">{isLetter ? <Plane size={12} /> : <Award size={12} />} {KIND[c.kind] ?? c.kind}</span>
        <span className={`tag ${status.tone}`}>{status.label}</span>
      </div>

      <div className="stack stack-2">
        <h4>{c.title}</h4>
        {c.destinationCity && <span className="small muted row" style={{ gap: 6 }}><Plane size={13} />{c.destinationCity}</span>}
        {c.church && (
          <Link to={`/churches/${c.church.slug}`} className="row small muted" style={{ gap: 8 }}>
            <span className="monogram monogram-sm">{c.church.monogram}</span>
            <span className="grow clamp-1">
              {c.church.name}
              {c.church.verified && <BadgeCheck size={12} style={{ display: 'inline', marginLeft: 4, verticalAlign: '-2px', color: 'var(--green-600)' }} />}
            </span>
          </Link>
        )}
      </div>

      {issued ? (
        <div className="stack stack-2" style={{ paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' }}>
          <div className="row-between xs"><span className="dim">Credential</span><span className="cred-id">{c.credentialId}</span></div>
          <div className="row-between xs"><span className="dim">Issued</span><span>{dateLong(c.issuedAt)}</span></div>
          {c.expiresAt && <div className="row-between xs"><span className="dim">Valid until</span><span>{dateLong(c.expiresAt)}</span></div>}
          <div className="row-between xs"><span className="dim">Verify code</span><span className="cred-id">{c.verifyCode}</span></div>

          <div className="row-wrap" style={{ gap: 8, marginTop: 'var(--s-2)' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => download(c)}>
              <Download size={14} /> Download PDF
            </button>
            <Link to={`/verify/${c.verifyCode}`} className="btn btn-outline btn-sm">
              <ShieldCheck size={14} /> Verify page
            </Link>
            <button type="button" className="btn btn-ghost btn-sm"
              onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/verify/${c.verifyCode}`)}>
              <Copy size={14} /> Copy link
            </button>
          </div>
        </div>
      ) : c.status === 'in-review' ? (
        <div className="notice notice-gold" style={{ marginTop: 'auto' }}>
          <Clock size={15} />
          <span>
            {c.churchName} is reviewing your submission. They sign it and it appears here.
            {c.offering?.requires?.review?.turnaroundDays ? ` Usually about ${plural(c.offering.requires.review.turnaroundDays, 'day')}.` : ''}
          </span>
        </div>
      ) : (
        <>
          <Blockers blockers={c.blockers ?? []} />
          {(c.blockers ?? []).some((b) => b.kind === 'assessment') && (
            <Link to={`/assessment/${c.credentialId}`} className="btn btn-primary btn-sm btn-block">
              Take the assessment
            </Link>
          )}
        </>
      )}
    </article>
  );
};

export const Passport = () => {
  const { data, error, loading, reload } = useApi('/me/passport');

  if (loading) return <div className="wrap band"><Spinner label="Opening your passport" /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const { holder, credentials, counts } = data;
  const issued = credentials.filter((c) => c.status === 'issued');
  const pending = credentials.filter((c) => c.status !== 'issued');
  const titles = issued.filter((c) => c.postNominal).map((c) => c.postNominal);

  return (
    <>
      <div className="band-warm" style={{ borderBottom: '1px solid var(--line)', paddingBlock: 'var(--s-6)' }}>
        <div className="wrap stack stack-5">
          <div className="passport-head">
            <Avatar src={holder.avatar} name={holder.name} size={64} />
            <div className="stack stack-1">
              <span className="eyebrow">Digital Minister Passport</span>
              <h1 style={{ fontSize: 'var(--text-2xl)' }}>
                {titles.length > 0 && <span style={{ color: 'var(--green-700)' }}>{titles[0]} </span>}
                {holder.name}
              </h1>
              <span className="small muted">
                {[holder.ministryRole, holder.country].filter(Boolean).join(' · ') || holder.email}
              </span>
            </div>
            <div className="row" style={{ gap: 'var(--s-5)' }}>
              {[['issued', counts.issued], ['with the church', counts.inReview], ['in progress', counts.inProgress]].map(([label, n]) => (
                <div key={label} className="stack" style={{ gap: 0 }}>
                  <span className="num strong" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)' }}>{n}</span>
                  <span className="xs dim">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="small muted" style={{ maxWidth: '72ch', margin: 0 }}>
            Every document a church issues to you is held here and can be downloaded as a PDF whenever you need it.
            Each one carries a code anyone can check on the public verification page.
          </p>
        </div>
      </div>

      <div className="wrap band-tight stack stack-7">
        {credentials.length === 0 ? (
          <Empty icon={IdCard} title="Nothing issued yet"
            action={<Link to="/ordination" className="btn btn-primary">Browse the marketplace</Link>}>
            Buy a credential and the document appears here, ready to download.
          </Empty>
        ) : (
          <>
            {pending.length > 0 && (
              <section className="stack stack-5">
                <div>
                  <h2 style={{ fontSize: 'var(--text-2xl)' }}>In progress</h2>
                  <p className="small muted">{plural(pending.length, 'credential')} waiting on something.</p>
                </div>
                <div className="cred-grid">
                  {pending.map((c) => <CredentialCard key={c.credentialId} credential={c} />)}
                </div>
              </section>
            )}

            {issued.length > 0 && (
              <section className="stack stack-5">
                <div>
                  <h2 style={{ fontSize: 'var(--text-2xl)' }}>Issued</h2>
                  <p className="small muted">{plural(issued.length, 'document')} signed and verifiable.</p>
                </div>
                <div className="cred-grid">
                  {issued.map((c) => <CredentialCard key={c.credentialId} credential={c} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
};
