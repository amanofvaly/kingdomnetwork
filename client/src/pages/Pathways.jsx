import { ArrowRight, Award, Layers } from 'lucide-react';

import { PathwayCard } from '../components/cards.jsx';
import { ErrorState, SkeletonGrid } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';

export const Pathways = () => {
  const { data, error, loading, reload } = useApi('/pathways');

  return (
    <>
      <section className="band-warm" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ paddingBlock: 'var(--s-7)' }}>
          <div className="stack stack-4" style={{ maxWidth: '62ch' }}>
            <span className="eyebrow">Credential pathways</span>
            <h1 style={{ fontSize: 'clamp(2rem, 3.6vw, 2.9rem)' }}>Courses that stack into a church-issued title.</h1>
            <p className="lede">
              A pathway combines taught courses with the parts a certificate alone cannot cover: an offline
              credential review, a written examination, a supervised practicum, or a board interview.
              Finishing one earns ordination, a diploma or a practitioner credential from the issuing church.
            </p>
          </div>
        </div>
      </section>

      <section className="band band-tight">
        <div className="wrap">
          {error ? <ErrorState error={error} onRetry={reload} />
            : loading ? <SkeletonGrid count={6} cols="grid-3" />
            : (
              <div className="grid grid-3">
                {data.map((p) => <PathwayCard key={p.slug} pathway={p} />)}
              </div>
            )}
        </div>
      </section>

      <section className="band band-sunken">
        <div className="wrap">
          <div className="grid grid-3">
            {[
              { icon: Layers, title: 'Stages, not modules', body: 'Each stage is a separate piece of work with its own outcome. You can see exactly what is required before you pay.' },
              { icon: Award, title: 'The church awards it', body: 'The title comes from the issuing ministry under its own standards. Kingdom Network records and verifies it.' },
              { icon: ArrowRight, title: 'Cheaper than the parts', body: 'A pathway costs less than buying its taught courses separately, and the assessment stages are included.' },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="feature">
                <Icon size={20} strokeWidth={1.7} />
                <h4>{title}</h4>
                <p className="small muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
