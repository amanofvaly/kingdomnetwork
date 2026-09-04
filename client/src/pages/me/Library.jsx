import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpen, Download, Headphones, Package, Receipt,
} from 'lucide-react';

import { AreaHero, Section, SectionHead, Tile, ZeroState } from '../../components/me/kit.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { bytes, dateShort, duration, money, plural } from '../../lib/format.js';
import { useApi } from '../../lib/useAsync.js';

/**
 * What this person owns, and what they paid for it.
 *
 * Materials come first and orders second, because the thing someone wants
 * from this page is nearly always the book rather than the receipt. Until now
 * a bought book had nowhere to be opened from at all — the files were written,
 * the enrolment was recorded, and nothing ever handed them back.
 */

const KIND_ICON = {
  audiobook: Headphones,
  album: Headphones,
  'sermon-series': Headphones,
};

const OrderStatus = ({ status }) => {
  const tone = status === 'paid' ? 'tag tag-green' : status === 'failed' ? 'tag tag-red' : 'tag tag-gold';
  const label = status === 'paid' ? 'Paid' : status === 'refunded' ? 'Refunded' : status === 'failed' ? 'Failed' : 'Pending';
  return <span className={tone}>{label}</span>;
};

const ResourceTile = ({ item, i }) => {
  const Icon = KIND_ICON[item.kind] ?? BookOpen;
  return (
    <Tile i={i} toned>
      {item.coverImage ? (
        <div className="me-tile-art" style={{ aspectRatio: '3 / 2' }}>
          <img src={item.coverImage} alt={item.coverAlt ?? ''} loading="lazy" />
        </div>
      ) : null}
      <div className="me-tile-body">
        {item.church ? <span className="xs dim clamp-1">{item.church.shortName ?? item.church.name}</span> : null}
        <h3 className="clamp-2">{item.title}</h3>
        {item.authorName ? <span className="small muted clamp-1">{item.authorName}</span> : null}
        <div className="me-tile-meta">
          <span className="row" style={{ gap: 5 }}><Icon size={13} /> {item.kind.replace(/-/g, ' ')}</span>
          {item.pages ? <span>{plural(item.pages, 'page')}</span> : null}
          {item.durationMinutes ? <span>{duration(item.durationMinutes)}</span> : null}
        </div>
      </div>
      <div className="me-tile-foot" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        {item.files.length ? (
          item.files.map((f) => (
            <a key={f.id} className="btn btn-primary btn-sm btn-block" href={f.url} download={f.filename ?? undefined}>
              <Download size={14} /> {item.files.length > 1 ? (f.filename ?? 'Download') : 'Download'}
              {f.bytes ? <span className="xs" style={{ opacity: .7 }}>({bytes(f.bytes)})</span> : null}
            </a>
          ))
        ) : (
          // Honest: the church has not attached the file yet, and that is not
          // something this person did wrong.
          <span className="small muted" style={{ textAlign: 'center' }}>
            {item.church?.shortName ?? 'The church'} has not attached a file to this yet.
          </span>
        )}
      </div>
    </Tile>
  );
};

export const MeLibrary = () => {
  const lib = useApi('/me/library');
  const orders = useApi('/orders');

  if (lib.loading || orders.loading) return <div className="me-wrap me-body"><Spinner /></div>;
  const error = lib.error ?? orders.error;
  if (error) {
    return (
      <div className="me-wrap me-body">
        <ErrorState error={error} onRetry={() => { lib.reload(); orders.reload(); }} />
      </div>
    );
  }

  const items = lib.data.items ?? [];
  const all = orders.data ?? [];
  const figures = [
    { value: items.length, label: items.length === 1 ? 'title' : 'titles' },
    { value: all.length, label: all.length === 1 ? 'order' : 'orders' },
  ].filter((f) => f.value > 0);

  return (
    <>
      <AreaHero
        art="/media/scenes/theology-shelf.webp"
        artAlt="A shelf of theology books"
        kicker="Library"
        title="Books and materials you own."
        lede={items.length
          ? 'Everything you have bought from a church on this network, ready to download.'
          : 'Books, study guides and audio published by the churches themselves gather here once you buy them.'}
        figures={figures}
      />

      <div className="me-wrap me-body">
        <Section tone="library">
          <SectionHead
            title="Your materials"
            lede={items.length ? 'Downloads do not expire, and buying once is enough.' : null}
            action={<Link to="/search" className="link">Find materials <ArrowRight size={14} /></Link>}
          />
          {items.length ? (
            <div className="me-grid me-grid-3 me-stagger">
              {items.map((item, i) => <ResourceTile key={item.slug} item={item} i={i} />)}
            </div>
          ) : (
            <ZeroState
              title="No materials yet"
              lede="Churches on this network publish their own books, workbooks and teaching audio. Anything you buy lands here to download, for good."
              art="/media/scenes/books-colorful.webp"
              action={<Link to="/search" className="btn btn-primary">Browse materials <ArrowRight size={16} /></Link>}
            />
          )}
        </Section>

        <Section tone="library">
          <SectionHead title="Orders" lede="Receipts for materials and coursework." />
          {all.length ? (
            <div className="me-list me-stagger">
              {all.map((o, i) => (
                <div key={o.reference} className="me-row" style={{ '--i': i }}>
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'grid', placeItems: 'center', flex: 'none', width: 44, height: 44,
                      borderRadius: 'var(--r-md)', background: 'var(--tone-soft)', color: 'var(--tone)',
                    }}
                  >
                    <Package size={19} strokeWidth={1.7} />
                  </span>
                  <div className="me-row-main">
                    <b className="clamp-1">
                      {plural(o.items?.length ?? 0, 'item')} · {o.items?.[0]?.title}
                    </b>
                    <span className="clamp-1">{o.reference} · {dateShort(o.createdAt)}</span>
                  </div>
                  <div className="me-row-end">
                    <span className="me-money">{money(o.total, o.currency)}</span>
                    <OrderStatus status={o.status} />
                    <Link to={`/orders/${o.reference}`} className="btn btn-outline btn-sm">
                      <Receipt size={14} /> Receipt
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ZeroState
              small
              title="No orders yet"
              lede="Anything you buy from a church will be receipted here, with the payment method and what it covered."
            />
          )}
        </Section>
      </div>
    </>
  );
};
