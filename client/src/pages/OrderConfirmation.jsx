import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, Download, FileCheck2, IdCard } from 'lucide-react';

import { ErrorState, Spinner } from '../components/ui.jsx';
import { getToken } from '../lib/api.js';
import { useApi } from '../lib/useAsync.js';
import { dateLong, money, plural } from '../lib/format.js';

const download = async (c) => {
  const res = await fetch(`/api/me/credentials/${c.credentialId}/document.pdf`, {
    headers: { authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${c.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${c.credentialId}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};

export const OrderConfirmation = () => {
  const { reference } = useParams();
  const { data, error, loading, reload } = useApi(`/orders/${reference}`);

  if (loading) return <div className="wrap band"><Spinner label="Loading your order" /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const { order, credentials } = data;
  const issued = credentials.filter((c) => c.status === 'issued');
  const pending = credentials.filter((c) => c.status !== 'issued');

  return (
    <div className="wrap band-tight">
      <div className="wrap-narrow stack stack-6" style={{ padding: 0, margin: '0 auto' }}>
        <div className="stack stack-4" style={{ alignItems: 'center', textAlign: 'center' }}>
          <CheckCircle2 size={44} strokeWidth={1.5} color="var(--green-600)" />
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>
            {issued.length > 0 ? 'Issued.' : 'Payment received.'}
          </h1>
          <p className="lede" style={{ maxWidth: '52ch' }}>
            {issued.length > 0
              ? `${plural(issued.length, 'document')} signed and in your passport. Download ${issued.length === 1 ? 'it' : 'them'} now or any time.`
              : 'Your credentials are in your passport with what each one is still waiting on.'}
          </p>
        </div>

        {issued.length > 0 && (
          <div className="stack stack-3">
            {issued.map((c) => (
              <div key={c.credentialId} className="cred issued">
                <span className="cred-seal" aria-hidden="true" />
                <div className="row-between">
                  <span className="tag tag-gold">Issued</span>
                  <span className="cred-id">{c.credentialId}</span>
                </div>
                <h3>{c.title}</h3>
                <span className="small muted">{c.churchName}</span>
                <button type="button" className="btn btn-primary btn-block" onClick={() => download(c)}>
                  <Download size={16} /> Download PDF
                </button>
              </div>
            ))}
          </div>
        )}

        {pending.length > 0 && (
          <div className="stack stack-3">
            {pending.map((c) => (
              <div key={c.credentialId} className="panel stack stack-3">
                <div className="row-between">
                  <h4>{c.title}</h4>
                  <span className={`tag ${c.status === 'in-review' ? 'tag-gold' : ''}`}>
                    {c.status === 'in-review' ? 'With the church' : 'Not yet issued'}
                  </span>
                </div>
                <div className="notice">
                  {c.status === 'in-review' ? <Clock size={15} /> : <FileCheck2 size={15} />}
                  <span>
                    {c.status === 'in-review'
                      ? `${c.churchName} is reviewing your submission and will sign it.`
                      : `${plural((c.outstanding ?? []).length, 'requirement')} outstanding. Your dashboard shows exactly what.`}
                  </span>
                </div>
                {(c.outstanding ?? []).includes('assessment') && (
                  <Link to={`/assessment/${c.credentialId}`} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
                    Take the assessment now
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="row-wrap" style={{ gap: 12, justifyContent: 'center' }}>
          <Link to="/passport" className="btn btn-primary btn-lg"><IdCard size={17} /> Open passport</Link>
          <Link to="/dashboard" className="btn btn-outline btn-lg">My account</Link>
        </div>

        <div className="panel stack stack-4">
          <div className="row-between">
            <div>
              <h4>Order {order.reference}</h4>
              <span className="small dim">{dateLong(order.paidAt ?? order.createdAt)}</span>
            </div>
            <span className="tag tag-green">Paid</span>
          </div>
          <div>
            {order.items.map((i) => (
              <div key={`${i.kind}-${i.slug}`} className="row-between small" style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                <span className="grow">{i.title} <span className="dim">· {i.churchName}</span></span>
                <span className="num strong">{money(i.price)}</span>
              </div>
            ))}
          </div>
          <div className="stack stack-3" style={{ paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' }}>
            <div className="total-row"><span>Paid with</span><span>{order.payment.label} {order.payment.account}</span></div>
            <div className="total-row"><span>Reference</span><span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{order.payment.reference}</span></div>
            <div className="total-row grand"><span>Total</span><span className="num">{money(order.total, order.currency)}</span></div>
          </div>
          {order.payment.simulated && (
            <div className="notice"><span>This payment ran through the built-in simulator.</span></div>
          )}
        </div>

        <div className="row" style={{ justifyContent: 'center' }}>
          <Link to="/orders" className="link small">All orders <ArrowRight size={14} /></Link>
        </div>
      </div>
    </div>
  );
};
