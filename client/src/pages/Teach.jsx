import { Link } from 'react-router-dom';
import { Award, BarChart3, ClipboardCheck, FileCheck2, IdCard, Layers, Users, Wallet } from 'lucide-react';

import { ChurchCard } from '../components/cards.jsx';
import { SkeletonGrid } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { compact } from '../lib/format.js';

export const Teach = () => {
  const { data, loading } = useApi('/churches');

  return (
    <>
      <section className="band-ink" style={{ paddingBlock: 'var(--s-9)' }}>
        <div className="wrap for-churches">
          <div className="stack stack-5">
            <span className="eyebrow">For churches and ministries</span>
            <h1 style={{ fontSize: 'clamp(2.1rem, 4vw, 3.1rem)' }}>Your syllabus. Your standards. Your credential.</h1>
            <p className="lede" style={{ color: 'rgba(255,255,255,.74)' }}>
              Publish what you already teach, take enrolments in the currencies your people actually use,
              and issue certificates and ordination directly into a minister&rsquo;s passport.
            </p>
            <div className="row-wrap" style={{ gap: 12 }}>
              <Link to="/onboarding" className="btn btn-inverse btn-lg">Set up your church</Link>
              <Link to="/churches" className="btn btn-inverse-outline btn-lg">See who is here</Link>
            </div>
          </div>
          <figure className="media media-4x3" style={{ margin: 0 }}>
            <img src="/media/scenes/lecture-theatre.webp" alt="A tiered lecture theatre" width={1600} height={1067} />
          </figure>
        </div>
      </section>

      <section className="band">
        <div className="wrap stack stack-6">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div>
              <h2>What's included</h2>
              <p>Everything you need to publish, assess and issue.</p>
            </div>
          </div>
          <div className="grid grid-4">
            {[
              { icon: Layers, title: 'Course and pathway builder', body: 'Sections, lessons, written material, quizzes and assignments. Stack courses into multi-stage pathways with review and examination steps.' },
              { icon: Wallet, title: 'Payments people can use', body: 'M-Pesa, Airtel Money, MTN MoMo and card at checkout, with your listing priced in your terms.' },
              { icon: ClipboardCheck, title: 'Assessment and review', body: 'Mark written work, review offline credentials, and run board interviews as formal stages inside a pathway.' },
              { icon: IdCard, title: 'Issuance and verification', body: 'Issue a credential into the holder’s passport with a public verification code that names your ministry.' },
              { icon: Users, title: 'A named profile', body: 'Your history, leadership, faculty, specialisms and delivery modes, on a page learners read before they enrol.' },
              { icon: FileCheck2, title: 'Applicant records', body: 'Enrolments, progress and completions in one place, with the evidence trail an award needs behind it.' },
              { icon: BarChart3, title: 'Reach beyond your region', body: 'Learners find you by outcome, by subject or by name, from anywhere the platform operates.' },
              { icon: Award, title: 'Your authority stays yours', body: 'Kingdom Network records and verifies what you issue. It does not accredit, endorse or award anything itself.' },
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

      <section className="band band-sunken">
        <div className="wrap stack stack-5">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div>
              <h2>Churches already teaching here</h2>
              <p>
                {loading ? 'Loading' : `${data.churches.length} ministries across ${new Set(data.churches.map((c) => c.region)).size} regions, teaching ${compact(data.churches.reduce((n, c) => n + (c.stats?.learners ?? 0), 0))} learners.`}
              </p>
            </div>
            <Link to="/churches" className="link">Full directory</Link>
          </div>
          {loading ? <SkeletonGrid count={4} /> : (
            <div className="grid grid-4">
              {data.churches.slice(0, 4).map((c) => <ChurchCard key={c.slug} church={c} />)}
            </div>
          )}
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="panel panel-warm row-between" style={{ gap: 'var(--s-5)', flexWrap: 'wrap', padding: 'var(--s-6)' }}>
            <div className="stack stack-2" style={{ maxWidth: '52ch' }}>
              <h3>Ready to publish?</h3>
              <p className="muted" style={{ margin: 0 }}>
                Create an account and set up your church profile in a few minutes.
              </p>
            </div>
            <Link to="/onboarding" className="btn btn-primary btn-lg">Set up your church</Link>
          </div>
        </div>
      </section>
    </>
  );
};
