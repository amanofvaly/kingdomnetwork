import { Link } from 'react-router-dom';
import { ArrowRight, HandCoins, Heart, Quote, Receipt } from 'lucide-react';

import { AreaHero, Section, SectionHead, Stat, ZeroState } from '../../components/me/kit.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { dateShort, money } from '../../lib/format.js';
import { useApi } from '../../lib/useAsync.js';

/**
 * Gifts, and everything else this person has paid.
 *
 * Giving led rather than buried in a ledger: a gift is not a transaction in
 * the way an order is, and listing it among receipts would say the wrong
 * thing about it. What the church nets after platform fees is deliberately
 * absent — that is the church's business, not the giver's.
 */

const KIND_TONE = {
  donation: 'tag tag-gold',
  application_fee: 'tag',
  renewal_fee: 'tag',
  course: 'tag',
  resource: 'tag',
};

const StatusTag = ({ status }) => {
  if (status === 'completed') return null;
  const cls = status === 'refunded' || status === 'reversed' ? 'tag tag-red' : 'tag tag-gold';
  const label = status === 'pending' ? 'Pending' : status === 'refunded' ? 'Refunded' : 'Reversed';
  return <span className={cls}>{label}</span>;
};

const EntryRow = ({ entry: e, i }) => (
  <div className="me-row" style={{ '--i': i }}>
    <span
      aria-hidden="true"
      style={{
        display: 'grid', placeItems: 'center', flex: 'none', width: 44, height: 44,
        borderRadius: 'var(--r-md)',
        background: e.kind === 'donation' ? 'var(--gold-50)' : 'var(--bg-sunken)',
        color: e.kind === 'donation' ? 'var(--gold-700)' : 'var(--ink-3)',
      }}
    >
      {e.kind === 'donation' ? <Heart size={18} strokeWidth={1.8} /> : <Receipt size={18} strokeWidth={1.8} />}
    </span>
    <div className="me-row-main">
      <b className="clamp-1">{e.cause ?? e.description ?? e.kindLabel}</b>
      <span className="clamp-1">
        {e.church?.name ?? 'Kingdom Network'} · {dateShort(e.at)}
      </span>
    </div>
    <div className="me-row-end">
      <span className={KIND_TONE[e.kind] ?? 'tag'}>{e.kindLabel}</span>
      <StatusTag status={e.status} />
      <span className="me-money">{money(e.amount, e.currency)}</span>
    </div>
  </div>
);

export const MeGiving = () => {
  const { data, error, loading, reload } = useApi('/me/statement');

  if (loading) return <div className="me-wrap me-body"><Spinner /></div>;
  if (error) return <div className="me-wrap me-body"><ErrorState error={error} onRetry={reload} /></div>;

  const { entries, totals } = data;
  const gifts = entries.filter((e) => e.kind === 'donation');
  const rest = entries.filter((e) => e.kind !== 'donation');
  const withMessage = gifts.filter((g) => g.message);

  const figures = totals.giftCount
    ? [
      { value: money(totals.given, totals.currency), label: 'given' },
      { value: totals.giftCount, label: totals.giftCount === 1 ? 'gift' : 'gifts' },
      { value: totals.churchesGivenTo, label: totals.churchesGivenTo === 1 ? 'church' : 'churches' },
    ]
    : [];

  return (
    <>
      <AreaHero
        art="/media/scenes/congregation-gathering.webp"
        artAlt="A congregation gathered together"
        kicker="Giving"
        title="Your giving."
        lede={totals.giftCount
          ? 'Every gift you have made through Kingdom Network, and everything else you have paid.'
          : 'Gifts you make to a church on this network are recorded here, alongside everything else you have paid.'}
        figures={figures}
      />

      <div className="me-wrap me-body">
        <Section tone="giving">
          <SectionHead
            title="Your gifts"
            lede={gifts.length ? 'Recorded as given, with the cause each one was for.' : null}
            action={<Link to="/churches" className="link">Find a church to support <ArrowRight size={14} /></Link>}
          />
          {gifts.length ? (
            <div className="me-list me-stagger">
              {gifts.map((e, i) => <EntryRow key={e.reference} entry={e} i={i} />)}
            </div>
          ) : (
            <ZeroState
              title="No gifts yet"
              lede="Churches on this network receive gifts towards named causes — a building fund, a mission, a benevolence fund. Anything you give is recorded here for your own records."
              art="/media/scenes/hands-raised-dark.webp"
              action={<Link to="/churches" className="btn btn-primary">Find a church <ArrowRight size={16} /></Link>}
            />
          )}
        </Section>

        {withMessage.length ? (
          <Section tone="giving">
            <SectionHead title="What you wrote" lede="The notes you sent with your gifts." />
            <div className="me-grid me-grid-2 me-stagger">
              {withMessage.slice(0, 4).map((g, i) => (
                <div key={g.reference} className="me-card" style={{ '--i': i }}>
                  <div className="me-card-in">
                    <Quote size={18} color="var(--gold-600)" />
                    <p className="prose" style={{ margin: 0, fontSize: 'var(--text-lg)', lineHeight: 1.55 }}>{g.message}</p>
                    <span className="small muted">
                      {g.cause ? `${g.cause} · ` : ''}{g.church?.name} · {dateShort(g.at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        <Section tone="giving">
          <SectionHead
            title="Everything you have paid"
            lede="Application fees, renewals, courses, materials and gifts, in one statement."
          />
          {entries.length ? (
            <>
              <div className="me-card" style={{ marginBottom: 'var(--s-4)' }}>
                <div className="me-card-in">
                  <div className="row" style={{ gap: 'clamp(20px, 3.4vw, 46px)', flexWrap: 'wrap' }}>
                    <Stat value={money(totals.paid, totals.currency)} label="paid in total" />
                    <Stat value={money(totals.given, totals.currency)} label="of that, given" />
                    <Stat value={entries.length} label="entries" />
                  </div>
                </div>
              </div>
              <div className="me-list me-stagger">
                {(rest.length ? entries : gifts).map((e, i) => <EntryRow key={e.reference} entry={e} i={i} />)}
              </div>
            </>
          ) : (
            <ZeroState
              small
              title="Nothing paid yet"
              lede="Application fees, course purchases and gifts will all appear here as one statement, so you never have to piece them together."
            />
          )}
        </Section>

        <Section tone="giving">
          <div className="me-card">
            <div className="me-card-in">
              <div className="row" style={{ gap: 'var(--s-4)', flexWrap: 'wrap' }}>
                <HandCoins size={24} strokeWidth={1.6} color="var(--gold-700)" />
                <div className="grow" style={{ minWidth: 240 }}>
                  <h3 style={{ fontSize: 'var(--text-lg)' }}>Giving does not need an account</h3>
                  <p className="small muted" style={{ margin: '4px 0 0' }}>
                    Anyone can give to a church here without signing in. Gifts made while you are signed in
                    are the ones recorded on this page.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
};
