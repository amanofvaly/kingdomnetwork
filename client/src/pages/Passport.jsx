import { Link } from 'react-router-dom';
import { Award, BadgeCheck, Clock, Copy, IdCard, ShieldCheck } from 'lucide-react';

import { Avatar, Empty, ErrorState, Monogram, Spinner } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { dateLong, plural } from '../lib/format.js';

const KIND_LABEL = {
  certificate: 'Certificate',
  ordination: 'Ordination',
  affiliation: 'Affiliation',
  'invitation-letter': 'Invitation letter',
};

const CredentialCard = ({ credential }) => {
  const issued = credential.status === 'issued';
  return (
    <article className={`credential ${issued ? 'is-issued' : ''}`}>
      {issued && <span className="seal" aria-hidden="true" />}
      <div className="row-between">
        <span className={`tag ${issued ? 'tag-gold' : ''}`}>
          {issued ? <Award size={12} /> : <Clock size={12} />}
          {KIND_LABEL[credential.kind] ?? credential.kind}
        </span>
        <span className={`tag ${issued ? 'tag-green' : ''}`}>{issued ? 'Issued' : 'In progress'}</span>
      </div>

      <div className="stack stack-2">
        <h4>{credential.title}</h4>
        {credential.church && (
          <Link to={`/churches/${credential.church.slug}`} className="row small muted" style={{ gap: 8 }}>
            <Monogram text={credential.church.monogram} size="monogram-sm" />
            <span>
              {credential.church.name}
              {credential.church.verified && <BadgeCheck size={13} style={{ display: 'inline', marginLeft: 4, verticalAlign: '-2px', color: 'var(--green-600)' }} />}
            </span>
          </Link>
        )}
      </div>

      <div className="stack stack-2" style={{ paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' }}>
        <div className="row-between xs">
          <span className="dim">Credential ID</span>
          <span className="cred-id">{credential.credentialId}</span>
        </div>
        {issued ? (
          <>
            <div className="row-between xs">
              <span className="dim">Issued</span>
              <span>{dateLong(credential.issuedAt)}</span>
            </div>
            <div className="row-between xs">
              <span className="dim">Verification code</span>
              <span className="cred-id">{credential.verifyCode}</span>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 'var(--s-2)' }}>
              <Link to={`/verify/${credential.verifyCode}`} className="btn btn-outline btn-sm">
                <ShieldCheck size={14} /> Verify page
              </Link>
              <button type="button" className="btn btn-ghost btn-sm"
                onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/verify/${credential.verifyCode}`)}>
                <Copy size={14} /> Copy link
              </button>
            </div>
          </>
        ) : (
          <p className="xs dim" style={{ margin: 0 }}>
            {credential.courseSlug
              ? 'Issued automatically once you complete every lesson on the course.'
              : 'Issued once every stage of the pathway is complete and reviewed.'}
          </p>
        )}
      </div>
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

  return (
    <>
      <div className="band-warm" style={{ borderBottom: '1px solid var(--line)', paddingBlock: 'var(--s-6)' }}>
        <div className="wrap stack stack-5">
          <div className="passport-head">
            <Avatar src={holder.avatar} name={holder.name} size={64} />
            <div className="stack stack-1">
              <span className="eyebrow">Digital Minister Passport</span>
              <h1 style={{ fontSize: 'var(--text-2xl)' }}>{holder.name}</h1>
              <span className="small muted">
                {[holder.ministryRole, holder.country].filter(Boolean).join(' · ') || holder.email}
              </span>
            </div>
            <div className="row" style={{ gap: 'var(--s-5)' }}>
              <div className="stack" style={{ gap: 0 }}>
                <span className="num strong" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)' }}>{counts.issued}</span>
                <span className="xs dim">issued</span>
              </div>
              <div className="stack" style={{ gap: 0 }}>
                <span className="num strong" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)' }}>{counts.inProgress}</span>
                <span className="xs dim">in progress</span>
              </div>
            </div>
          </div>
          <p className="small muted" style={{ maxWidth: '68ch', margin: 0 }}>
            Everything a church issues to you is recorded here with a code anyone can check on the public
            verification page. Nothing here is issued by Kingdom Network — each credential belongs to the
            ministry named on it.
          </p>
        </div>
      </div>

      <div className="wrap band-tight stack stack-7">
        {credentials.length === 0 ? (
          <Empty icon={IdCard} title="No credentials yet"
            action={<Link to="/courses" className="btn btn-primary">Browse courses</Link>}>
            Enrol on a course or a pathway. The certificate it carries appears here as soon as the church issues it.
          </Empty>
        ) : (
          <>
            {issued.length > 0 && (
              <section className="stack stack-5">
                <div>
                  <h2 style={{ fontSize: 'var(--text-2xl)' }}>Issued</h2>
                  <p className="small muted">{plural(issued.length, 'credential')} awarded and verifiable.</p>
                </div>
                <div className="grid grid-3">
                  {issued.map((c) => <CredentialCard key={c.credentialId} credential={c} />)}
                </div>
              </section>
            )}
            {pending.length > 0 && (
              <section className="stack stack-5">
                <div>
                  <h2 style={{ fontSize: 'var(--text-2xl)' }}>In progress</h2>
                  <p className="small muted">Finish the work and these are issued automatically.</p>
                </div>
                <div className="grid grid-3">
                  {pending.map((c) => <CredentialCard key={c.credentialId} credential={c} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
};
