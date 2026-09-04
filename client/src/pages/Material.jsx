import { Link, useParams } from 'react-router-dom';
import { BookOpen, Download } from 'lucide-react';

import { MaterialCard } from '../components/cards.jsx';
import { MediaPlayer } from '../components/MediaPlayer.jsx';
import { ErrorState, Price, Spinner, Verified } from '../components/ui.jsx';
import { useCart } from '../lib/cart.jsx';
import { duration, plural } from '../lib/format.js';
import { useApi } from '../lib/useAsync.js';

/**
 * One material, presented as whatever it actually is.
 *
 * A sermon series and a workbook are the same record with different files
 * attached, so the page reads the mime type rather than the kind: what decides
 * whether something plays is whether it is playable.
 */

const KIND_LABEL = {
  book: 'Book',
  audiobook: 'Audiobook',
  'study-guide': 'Study guide',
  'sermon-series': 'Sermon series',
  album: 'Album',
  workbook: 'Workbook',
};

export const Material = () => {
  const { slug } = useParams();
  const { data, error, loading, reload } = useApi(`/resources/${slug}`);
  const { add, has } = useCart();

  if (loading) return <div className="wrap band"><Spinner /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const { resource, church, alsoFrom, owned, sample, files } = data;
  const inCart = has('resource', resource.slug);
  const kindLabel = KIND_LABEL[resource.kind] ?? 'Material';

  const facts = [
    resource.pages ? plural(resource.pages, 'page') : null,
    resource.durationMinutes ? duration(resource.durationMinutes) : null,
    resource.language,
  ].filter(Boolean);

  return (
    <>
      <div className="band-warm material-head">
        <div className="wrap material-head-grid">
          <div className="material-cover">
            <img src={resource.coverImage} alt={resource.coverAlt ?? ''} />
          </div>

          <div className="stack stack-3">
            <span className="eyebrow">{kindLabel}</span>
            <h1>{resource.title}</h1>
            {resource.subtitle ? <p className="lede">{resource.subtitle}</p> : null}
            {resource.authorName ? <p className="muted" style={{ margin: 0 }}>By {resource.authorName}</p> : null}

            {church ? (
              <Link to={`/churches/${church.slug}`} className="row small" style={{ gap: 8 }}>
                <span>Published by {church.shortName ?? church.name}</span>
                {church.verified && <Verified label="" size={14} />}
              </Link>
            ) : null}

            {facts.length ? (
              <div className="course-meta">
                {facts.map((fact, i) => <span key={fact}>{i > 0 && <span className="dot" />}{fact}</span>)}
              </div>
            ) : null}
          </div>

          <aside className="panel material-buy">
            {owned ? (
              <div className="stack stack-3">
                <strong>Yours</strong>
                <p className="small muted" style={{ margin: 0 }}>
                  {plural(files.length, 'file')} to play or download. It stays in your library.
                </p>
                {files.map((file) => (
                  <div key={file.id} className="stack stack-2">
                    <MediaPlayer asset={file} poster={resource.coverImage} />
                    <a className="btn btn-outline btn-sm btn-block" href={file.url} download={file.filename}>
                      <Download size={14} /> Download
                    </a>
                  </div>
                ))}
                <Link className="link small" to="/me/library">Everything you own →</Link>
              </div>
            ) : (
              <div className="stack stack-3">
                <Price amount={resource.price} was={resource.compareAtPrice} currency={resource.currency} size="lg" />
                {inCart ? (
                  <Link to="/cart" className="btn btn-primary btn-block">In your basket</Link>
                ) : (
                  <button type="button" className="btn btn-primary btn-block"
                    onClick={() => add({ kind: 'resource', slug: resource.slug })}>
                    {resource.price ? 'Add to basket' : 'Get it free'}
                  </button>
                )}
                <p className="xs dim" style={{ margin: 0 }}>
                  Bought once and kept. It appears in your library the moment the payment clears.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>

      <div className="wrap band">
        <div className="material-body stack stack-6">
          {sample ? (
            <section className="stack stack-3">
              <h2>A sample</h2>
              <MediaPlayer asset={sample} poster={resource.coverImage} />
            </section>
          ) : null}

          {resource.description?.length ? (
            <section className="stack stack-3">
              <h2>About this {kindLabel.toLowerCase()}</h2>
              {resource.description.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
            </section>
          ) : null}

          {!sample && !resource.description?.length ? (
            <p className="muted">
              {church?.shortName ?? 'This church'} has not added a description yet.
            </p>
          ) : null}
        </div>

        {alsoFrom?.length ? (
          <section className="stack stack-4" style={{ marginTop: 'var(--s-7)' }}>
            <h2 className="row" style={{ gap: 8 }}>
              <BookOpen size={20} /> More from {church?.shortName ?? 'this church'}
            </h2>
            <div className="grid grid-3">
              {alsoFrom.map((item) => <MaterialCard key={item.slug} item={{ ...item, church }} />)}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
};
