import {
  ArrowRight, BadgeCheck, BookOpen, Church, Headphones, MapPin, Users,
} from 'lucide-react';

const Feature = ({ icon: Icon, children }) => (
  <span className="banner-feature"><span className="banner-feature-icon"><Icon size={20} /></span><span>{children}</span></span>
);

const Identity = () => (
  <div className="banner-identity"><span className="banner-monogram">FL</span><span>Faith Life Church</span><BadgeCheck size={21} fill="currentColor" /></div>
);

const Actions = () => (
  <div className="banner-actions">
    <span className="banner-action banner-action-primary">View church <ArrowRight size={19} /></span>
    <span className="banner-action banner-action-secondary">See credentials</span>
  </div>
);

const DirectionOne = () => (
  <article className="church-art church-art-one">
    <div className="art-copy">
      <span className="art-kicker">Featured church</span><Identity />
      <h2>Pastoral formation for the Great Lakes region.</h2>
      <p><MapPin size={17} /> Kampala, Uganda</p><Actions />
    </div>
    <div className="art-object art-object-pass">
      <div className="object-topline"><span>FL</span><BadgeCheck size={35} /></div>
      <strong>Faith Life<br />Church</strong><small>Formation that travels with the pastor.</small>
      <div className="object-features"><Feature icon={Church}>Ordination</Feature><Feature icon={Headphones}>Audio-first</Feature><Feature icon={Users}>Cohorts</Feature></div>
    </div>
    <i className="art-star art-star-a">✦</i><i className="art-star art-star-b">✦</i>
  </article>
);

const DirectionTwo = () => (
  <article className="church-art church-art-two">
    <div className="art-two-orbit" aria-hidden="true"><span>FL</span></div>
    <div className="art-copy">
      <span className="art-kicker">Kampala · Uganda</span><Identity />
      <h2>Built for pastors already doing the work.</h2>
      <p>Pastoral formation, ordination pathways and regional cohorts.</p><Actions />
    </div>
    <div className="art-two-ribbon"><Feature icon={BookOpen}>Pastoral formation</Feature><Feature icon={Church}>Ordination pathways</Feature><Feature icon={Headphones}>Mobile learning</Feature></div>
  </article>
);

const DirectionThree = () => (
  <article className="church-art church-art-three">
    <div className="art-three-copy">
      <span className="art-kicker">Featured church</span><Identity />
      <h2>Training that reaches beyond Kampala.</h2>
      <p>Audio-first study and regional assessment for serving leaders.</p><Actions />
    </div>
    <div className="art-three-stack" aria-hidden="true">
      <span className="stack-card stack-card-back">REGIONAL<br />COHORTS</span>
      <span className="stack-card stack-card-mid">AUDIO<br />FIRST</span>
      <span className="stack-card stack-card-front"><b>FL</b><strong>Faith Life<br />Church</strong><BadgeCheck size={31} /></span>
    </div>
    <div className="art-three-track"><span>01</span><i /><span>02</span><i /><span>03</span></div>
  </article>
);

export const ChurchBannerConcept = () => (
  <main className="banner-concept-page">
    <header className="banner-concept-head"><span>Church banner study</span><h1>Three directions. One church.</h1><p>Same content in every banner. Compare the composition, not the copy.</p></header>
    <section className="banner-concept-list">
      <div><span className="concept-label">Direction 01 · The church pass</span><DirectionOne /></div>
      <div><span className="concept-label">Direction 02 · The signal</span><DirectionTwo /></div>
      <div><span className="concept-label">Direction 03 · The pathway stack</span><DirectionThree /></div>
    </section>
  </main>
);
