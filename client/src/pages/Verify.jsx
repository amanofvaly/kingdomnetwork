import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, ShieldCheck, ShieldX } from 'lucide-react';

import { Monogram, Spinner } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { dateLong } from '../lib/format.js';

const KIND_LABEL = { certificate: 'Certificate', ordination: 'Ordination', license: 'Licence', affiliation: 'Affiliation', 'invitation-letter': 'Invitation letter' };

export const Verify = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState('');
  const { data, error, loading } = useApi(code ? `/verify/${code}` : null, { skip: !code });

  return (
    <div className="wrap band-tight">
      <div className="wrap-narrow stack stack-6" style={{ padding: 0, margin: '0 auto' }}>
        <div className="stack stack-3">
          <span className="eyebrow">Credential verification</span>
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>Check a credential.</h1>
          <p className="lede">
            Enter the verification code printed on a certificate or shared by its holder. The result shows
            the issuing church, the title and the date it was issued.
          </p>
        </div>

        <form className="search" onSubmit={(e) => { e.preventDefault(); if (entry.trim()) navigate(`/verify/${entry.trim().toUpperCase()}`); }}>
          <ShieldCheck size={18} color="var(--ink-3)" />
          <input value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="Verification code" aria-label="Verification code"
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: '.06em', textTransform: 'uppercase' }} />
          <button type="submit" className="btn btn-primary btn-sm">Verify</button>
        </form>

        {loading && <Spinner label="Checking" />}

        {code && error && (
          <div className="panel stack stack-3" style={{ borderColor: '#efd7d0', background: 'var(--red-50)' }}>
            <div className="row" style={{ gap: 'var(--s-3)' }}>
              <ShieldX size={22} color="var(--red-600)" />
              <div>
                <h4 style={{ color: 'var(--red-600)' }}>No credential matches that code</h4>
                <p className="small" style={{ margin: 0, color: 'var(--red-600)' }}>
                  Check the code and try again.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* A revoked credential is reported as revoked, not as missing. Someone
            checking a document has to be told it was withdrawn — that is the
            whole reason verification exists. */}
        {data?.state === 'revoked' && (
          <div className="panel stack stack-3" style={{ borderColor: '#efd7d0', background: 'var(--red-50)' }}>
            <div className="row" style={{ gap: 'var(--s-3)' }}>
              <ShieldX size={22} color="var(--red-600)" />
              <div>
                <h4 style={{ color: 'var(--red-600)' }}>This credential has been withdrawn</h4>
                <p className="small" style={{ margin: 0, color: 'var(--red-600)' }}>
                  {data.title} was issued to {data.holderName} and later revoked by the issuing church
                  {data.revokedAt ? ` on ${dateLong(data.revokedAt)}` : ''}.
                  {data.reason ? ` ${data.reason}` : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {data && data.state !== 'revoked' && (
          <div className={`credential ${data.state === 'issued' ? 'is-issued' : ''}`}>
            <span className="seal" aria-hidden="true" />
            <div className="row" style={{ gap: 10 }}>
              {data.state === 'issued' ? (
                <>
                  <BadgeCheck size={20} color="var(--green-600)" />
                  <span className="strong small" style={{ color: 'var(--green-700)' }}>
                    Verified. Issued by this church and currently valid.
                  </span>
                </>
              ) : (
                <>
                  <ShieldX size={20} color="var(--gold-700)" />
                  <span className="strong small" style={{ color: 'var(--gold-700)' }}>
                    Expired. Issued by the church below, now lapsed.
                  </span>
                </>
              )}
            </div>
            <div className="stack stack-3" style={{ paddingTop: 'var(--s-4)', borderTop: '1px solid var(--gold-100)' }}>
              <div className="stack" style={{ gap: 2 }}>
                <span className="xs dim">Credential</span>
                <h3>{data.title}</h3>
              </div>
              <div className="stack" style={{ gap: 2 }}>
                <span className="xs dim">Held by</span>
                <span className="strong">{data.holderName}</span>
              </div>
              {data.church && (
                <div className="stack stack-2">
                  <span className="xs dim">Issued by</span>
                  <Link to={`/churches/${data.church.slug}`} className="row" style={{ gap: 10 }}>
                    <Monogram text={data.church.shortName?.slice(0, 2).toUpperCase()} size="monogram-sm" />
                    <span>
                      <span className="strong small" style={{ display: 'block' }}>{data.church.name}</span>
                      <span className="xs dim">{data.church.city}, {data.church.country}</span>
                    </span>
                  </Link>
                </div>
              )}
              <div className="row-between small" style={{ paddingTop: 'var(--s-3)', borderTop: '1px solid var(--gold-100)' }}>
                <span className="dim">Type</span><span>{KIND_LABEL[data.kind] ?? data.kind}</span>
              </div>
              <div className="row-between small"><span className="dim">Issued</span><span>{dateLong(data.issuedAt)}</span></div>
              {data.expiresAt && <div className="row-between small"><span className="dim">Valid until</span><span>{dateLong(data.expiresAt)}</span></div>}
              {data.destinationCity && <div className="row-between small"><span className="dim">Invited to</span><span>{data.destinationCity}</span></div>}
              {data.purpose && <div className="row-between small"><span className="dim">Purpose</span><span style={{ textAlign: 'right', maxWidth: '60%' }}>{data.purpose}</span></div>}
              <div className="row-between small"><span className="dim">Credential ID</span><span className="cred-id">{data.credentialId}</span></div>
            </div>
          </div>
        )}

        <div className="notice">
          <span>
            Kingdom Network records what a church issues and makes it checkable. The standards behind a credential,
            and whether any other body recognises it, are matters for the issuing ministry.
          </span>
        </div>
      </div>
    </div>
  );
};
