import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Award, BadgeCheck, Globe, GraduationCap, IdCard, Search, Signal, Wallet,
} from 'lucide-react';

import { CourseCard, ChurchCard, PathwayCard } from '../components/cards.jsx';
import { ErrorState, SkeletonGrid } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { compact } from '../lib/format.js';

const Hero = ({ totals }) => {
  const navigate = useNavigate();
  return (
    <section className="hero">
      <div className="wrap hero-inner">
        <div className="hero-copy stack stack-5">
          <span className="eyebrow">Church-issued learning and credentials</span>
          <h1 className="display">
            Study with a church.<br />Carry the credential it issues.
          </h1>
          <p className="lede">
            Courses, certificates and ordination pathways taught by ministries in East Africa, West Africa
            and the United States. Everything you earn is recorded in your Digital Minister Passport.
          </p>

          <form
            className="search hero-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get('q')?.toString().trim();
              navigate(q ? `/courses?q=${encodeURIComponent(q)}` : '/courses');
            }}
          >
            <Search size={19} strokeWidth={1.8} color="var(--ink-3)" />
            <input name="q" type="search" placeholder="Ordination, pastoral care, Greek, church finance…" aria-label="Search courses" />
            <button type="submit" className="btn btn-primary btn-sm">Search</button>
          </form>

          <ul className="hero-stats">
            <li><strong className="num">{totals ? compact(totals.learners) : '—'}</strong><span>learners enrolled</span></li>
            <li><strong className="num">{totals?.courses ?? '—'}</strong><span>courses and pathways</span></li>
            <li><strong className="num">{totals?.churches ?? '—'}</strong><span>issuing churches</span></li>
            <li><strong className="num">{totals ? compact(totals.credentials) : '—'}</strong><span>credentials issued</span></li>
          </ul>
        </div>

        <div className="hero-art" aria-hidden="true">
          <figure className="hero-art-main media">
            <img src="/media/scenes/students-writing.webp" alt="" width={1600} height={1067} fetchPriority="high" />
          </figure>
          <figure className="hero-art-a media">
            <img src="/media/scenes/congregation-gathering@800.webp" alt="" width={800} height={534} loading="lazy" />
          </figure>
          <figure className="hero-art-b media">
            <img src="/media/people/p-elder-bearded-smile.webp" alt="" width={640} height={800} loading="lazy" />
          </figure>
        </div>
      </div>
    </section>
  );
};

const CategoryStrip = ({ categories }) => (
  <div className="wrap" style={{ paddingBottom: 'var(--s-6)' }}>
    <div className="chip-scroll">
      <Link to="/courses" className="chip">All courses</Link>
      {categories.map((c) => (
        <Link key={c.slug} to={`/courses?category=${encodeURIComponent(c.name)}`} className="chip">{c.name}</Link>
      ))}
    </div>
  </div>
);

const HowItWorks = () => (
  <section className="band band-warm">
    <div className="wrap">
      <div className="how">
        <div className="stack stack-5">
          <span className="eyebrow">How a credential is built</span>
          <h2>Courses combine into pathways. Pathways issue titles.</h2>
          <p className="lede">
            A single course earns a certificate. Stack the right courses with an offline credential
            review, a written examination and a board interview, and a church can issue ordination.
          </p>
          <ol className="steps">
            <li>
              <span className="step-n">1</span>
              <div><h4>Choose an outcome or a church</h4><p className="small muted">Browse by the credential you want, or start from a ministry you already trust.</p></div>
            </li>
            <li>
              <span className="step-n">2</span>
              <div><h4>Work through the material</h4><p className="small muted">Lessons, written notes and assessed quizzes. Audio versions throughout for low-bandwidth access.</p></div>
            </li>
            <li>
              <span className="step-n">3</span>
              <div><h4>The church issues the credential</h4><p className="small muted">It lands in your passport with a verification code anyone can check.</p></div>
            </li>
          </ol>
          <Link to="/pathways" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            Browse credential pathways <ArrowRight size={16} />
          </Link>
        </div>

        <figure className="how-art">
          <div className="media media-4x3">
            <img src="/media/scenes/graduation-caps.webp" alt="Graduates throwing their caps into the air" width={1600} height={1067} loading="lazy" />
          </div>
          <div className="passport-chip">
            <IdCard size={18} />
            <div>
              <div className="strong small">Digital Minister Passport</div>
              <div className="xs dim">Certificates, ordinations and affiliations in one place</div>
            </div>
          </div>
        </figure>
      </div>
    </div>
  </section>
);

const Features = () => (
  <section className="band band-tight">
    <div className="wrap">
      <div className="grid grid-4">
        {[
          { icon: BadgeCheck, title: 'The issuer is always named', body: 'Every course, certificate and title shows the church behind it, where it is based, and who teaches it.' },
          { icon: Signal, title: 'Built for slow connections', body: 'Audio versions of every lesson, written notes you can read offline, and pages that stay under a megabyte.' },
          { icon: Wallet, title: 'Pay the way you already pay', body: 'M-Pesa, Airtel Money, MTN MoMo, card, PayPal and bank transfer at checkout.' },
          { icon: Globe, title: 'East Africa first, open to everyone', body: 'Launching around ministries in Uganda, Kenya, Ghana and the United States, with global enrolment.' },
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
);

const ForChurches = () => (
  <section className="band-ink">
    <div className="wrap for-churches">
      <div className="stack stack-5">
        <span className="eyebrow">For churches and ministries</span>
        <h2>Teach, assess and issue — on your own terms.</h2>
        <p className="lede" style={{ color: 'rgba(255,255,255,.74)' }}>
          Publish courses and pathways, review applicants, and issue certificates and ordination
          directly into a minister&rsquo;s passport. Your name, your standards, your syllabus.
        </p>
        <ul className="tick-list">
          <li><Award size={16} /> Publish courses, certificates and multi-stage pathways</li>
          <li><GraduationCap size={16} /> Assess coursework and review offline credentials</li>
          <li><IdCard size={16} /> Issue credentials with a public verification code</li>
        </ul>
        <div className="row-wrap" style={{ gap: 12 }}>
          <Link to="/teach" className="btn btn-inverse">Teach on Kingdom Network</Link>
          <Link to="/churches" className="btn btn-inverse-outline">See the churches already here</Link>
        </div>
      </div>
      <figure className="media media-4x3">
        <img src="/media/scenes/seminar-room.webp" alt="A teaching session under way in a seminar room" width={1600} height={1067} loading="lazy" />
      </figure>
    </div>
  </section>
);

export const Home = () => {
  const { data, error, loading, reload } = useApi('/home');

  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  return (
    <>
      <Hero totals={data?.totals} />
      {data && <CategoryStrip categories={data.categories} />}

      <section className="band band-tight">
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2>Most enrolled this month</h2>
              <p>Courses learners are working through right now, across every issuing church.</p>
            </div>
            <Link to="/courses" className="link">All courses <ArrowRight size={15} /></Link>
          </div>
          {loading ? <SkeletonGrid /> : (
            <div className="grid grid-4">
              {data.popular.map((c) => <CourseCard key={c.slug} course={c} />)}
            </div>
          )}
        </div>
      </section>

      <HowItWorks />

      <section className="band band-tight">
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2>Credential pathways</h2>
              <p>Stacked programmes that end in a church-issued title rather than a single certificate.</p>
            </div>
            <Link to="/pathways" className="link">All pathways <ArrowRight size={15} /></Link>
          </div>
          {loading ? <SkeletonGrid count={3} cols="grid-3" /> : (
            <div className="grid grid-3">
              {data.pathways.slice(0, 3).map((p) => <PathwayCard key={p.slug} pathway={p} />)}
            </div>
          )}
        </div>
      </section>

      <section className="band band-sunken">
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2>The churches issuing them</h2>
              <p>Every credential on Kingdom Network is issued by a named ministry with a profile you can read first.</p>
            </div>
            <Link to="/churches" className="link">All churches <ArrowRight size={15} /></Link>
          </div>
          {loading ? <SkeletonGrid count={4} /> : (
            <div className="grid grid-4">
              {data.churches.slice(0, 8).map((c) => <ChurchCard key={c.slug} church={c} />)}
            </div>
          )}
        </div>
      </section>

      <Features />
      <ForChurches />
    </>
  );
};
