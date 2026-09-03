import { Link } from 'react-router-dom';
import {
  Award, BadgeCheck, Clock, Copy, Download, IdCard, Plane, ShieldCheck,
} from 'lucide-react';

import { Avatar, Empty, ErrorState, Spinner } from '../components/ui.jsx';
import { getToken } from '../lib/api.js';
import { StatusPill } from '../components/admin/kit.jsx';
import { useApi } from '../lib/useAsync.js';
import { dateLong, plural } from '../lib/format.js';

const KIND = {
  certificate: 'Certificate',
  ordination: 'Ordination',
  license: 'Licence',
  affiliation: 'Affiliation',
  'invitation-letter': 'Invitation letter',
};

const STATUS = {
  issued: { label: 'Issued', tone: 'tag-green' },
  expired: { label: 'Expired', tone: 'tag-gold' },
  // Reported as withdrawn rather than hidden: someone checking a document needs
  // to be told it was revoked, not that it never existed.
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

const CredentialCard = ({ credential: c }) => {
  const issued = c.status === 'issued';
  const isLetter = c.kind === 'invitation-letter';
  const status = STATUS[c.expired ? 'expired' : c.status] ?? STATUS.issued;

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
      ) : (
        <div className="notice" style={{ marginTop: 'auto' }}>
          <Clock size={15} />
          <span>{c.expired ? 'This has expired.' : 'This is no longer current.'}</span>
        </div>
      )}
    </article>
  );
};


/** Something still in flight with a church. Issued credentials sit alongside. */
const ApplicationCard = ({ application: a }) => (
  <article className="cred">
    <div className="row-between">
      <span className="tag"><Award size={12} /> Applied for</span>
      <StatusPill status={a.status} />
    </div>

    <div className="stack stack-2">
      <h4>{a.offeringTitle}</h4>
      {a.church && (
        <Link to={`/churches/${a.church.slug}`} className="row small muted" style={{ gap: 8 }}>
          <span className="monogram monogram-sm">{a.church.monogram}</span>
          <span className="grow clamp-1">{a.church.name}</span>
        </Link>
      )}
    </div>

    <div className="stack stack-2" style={{ marginTop: 'auto', paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' }}>
      <span className="progress">
        <span style={{ width: `${Math.round(((a.steps ?? []).filter((s) => s.status === 'complete' || s.status === 'waived').length / Math.max(1, (a.steps ?? []).length)) * 100)}%` }} />
      </span>
      <Link to={`/applications/${a.reference}`} className="btn btn-outline btn-sm btn-block">
        View progress
      </Link>
    </div>
  </article>
);

/** One line saying what, between them, the live applications are waiting on. */
const pendingSummary = (applications) => {
  if (applications.length === 1) {
    const [a] = applications;
    const next = (a.steps ?? []).find((s) => s.status !== 'complete' && s.status !== 'waived');
    if (!next) return `${a.church?.name ?? 'The church'} is deciding on ${a.offeringTitle}.`;
    if (next.type === 'review') return `${a.church?.name ?? 'The church'} is reading your application.`;
    return `${next.label} — before ${a.offeringTitle} can be issued.`;
  }

  const withChurch = applications.filter((a) => ['final_review', 'under_review', 'submitted'].includes(a.status)).length;
  const yours = applications.length - withChurch;
  return [
    yours > 0 && `${plural(yours, 'application')} ${yours === 1 ? 'needs' : 'need'} something from you.`,
    withChurch > 0 && `${plural(withChurch, 'application')} ${withChurch === 1 ? 'is' : 'are'} with the church.`,
  ].filter(Boolean).join(' ');
};

export const Passport = () => {
  const { data, error, loading, reload } = useApi('/me/passport');

  if (loading) return <div className="wrap band"><Spinner label="Opening your passport" /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const { holder, credentials, applications, counts } = data;
  const issued = credentials.filter((c) => c.status === 'issued' && !c.expired);
  const lapsed = credentials.filter((c) => c.expired || c.status !== 'issued');
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
              {[['issued', counts.issued], ['in progress', counts.inProgress], ['expired', counts.expired]].map(([label, n]) => (
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
        {credentials.length === 0 && applications.length === 0 ? (
          <Empty icon={IdCard} title="Nothing here yet"
            action={<Link to="/ordination" className="btn btn-primary">See what churches issue</Link>}>
            Your credentials are stored here, ready to download.
          </Empty>
        ) : (
          <>
            {applications.length > 0 && (
              <section className="stack stack-5">
                <div>
                  <h2 style={{ fontSize: 'var(--text-2xl)' }}>In progress</h2>
                  <p className="small muted">{pendingSummary(applications)}</p>
                </div>
                <div className="cred-grid">
                  {applications.map((a) => <ApplicationCard key={a.reference} application={a} />)}
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

            {lapsed.length > 0 && (
              <section className="stack stack-5">
                <div>
                  <h2 style={{ fontSize: 'var(--text-2xl)' }}>No longer current</h2>
                  <p className="small muted">
                    Expired or withdrawn credentials.
                  </p>
                </div>
                <div className="cred-grid">
                  {lapsed.map((c) => <CredentialCard key={c.credentialId} credential={c} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
};
