import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { CHURCH_PLACEHOLDER } from '../ui.jsx';

/**
 * The vocabulary of the user area.
 *
 * Two rules hold the whole thing together. Sections declare a `--tone` and
 * everything inside inherits it, so no child needs to know where it lives.
 * And nothing renders an empty box: a list with nothing in it renders a
 * ZeroState instead, which is art, one sentence, and one thing to do.
 */

/* Each section's accent and its signature photograph. Tone values come from
   tokens.css; the photographs are already in the repo. */
export const TONES = {
  home: { tone: 'var(--blue-700)', soft: 'var(--blue-50)', onDark: '#ffe1a3', art: '/media/scenes/sunrise-arms-raised.webp' },
  journey: { tone: 'var(--blue-600)', soft: 'var(--blue-50)', onDark: '#bcd0ff', art: '/media/scenes/seminar-room.webp' },
  passport: { tone: 'var(--gold-600)', soft: 'var(--gold-50)', onDark: '#ffe1a3', art: '/media/church-registration-cross.jpg' },
  learning: { tone: 'var(--aqua)', soft: 'var(--aqua-soft)', onDark: '#8fe6e2', art: '/media/scenes/hands-open-bible.webp' },
  library: { tone: 'var(--coral)', soft: 'var(--coral-soft)', onDark: '#ffc3b3', art: '/media/scenes/theology-shelf.webp' },
  giving: { tone: 'var(--gold-700)', soft: 'var(--gold-50)', onDark: '#ffe1a3', art: '/media/scenes/congregation-gathering.webp' },
  inbox: { tone: 'var(--blue-700)', soft: 'var(--blue-50)', onDark: '#bcd0ff', art: '/media/scenes/discussion-table.webp' },
  profile: { tone: 'var(--blue-700)', soft: 'var(--blue-50)', onDark: '#bcd0ff', art: '/media/scenes/handshake.webp' },
  settings: { tone: 'var(--ink)', soft: 'var(--bg-sunken)', onDark: '#bcd0ff', art: '/media/scenes/open-notebook.webp' },
};

/** Put a section's tone on a wrapper so its children inherit it. */
export const toneStyle = (key) => {
  const t = TONES[key] ?? TONES.home;
  return { '--tone': t.tone, '--tone-soft': t.soft, '--tone-on-dark': t.onDark };
};

export const Section = ({ tone = 'home', className = '', children, ...rest }) => (
  <section className={`me-section ${className}`} style={toneStyle(tone)} {...rest}>
    {children}
  </section>
);

/* --- hero ---------------------------------------------------------------- */

export const AreaHero = ({ kicker, title, lede, art, artAlt = '', tall = false, actions, figures }) => (
  <header className={`me-hero ${tall ? 'me-hero-tall' : ''}`}>
    {art ? <img src={art} alt={artAlt} /> : null}
    <div className="me-hero-inner">
      {kicker ? <div className="me-kicker">{kicker}</div> : null}
      <h1>{title}</h1>
      {lede ? <p>{lede}</p> : null}
      {actions ? <div className="me-hero-actions">{actions}</div> : null}
      {figures?.length ? (
        <div className="me-hero-figures">
          {figures.map((f) => <Stat key={f.label} value={f.value} label={f.label} />)}
        </div>
      ) : null}
    </div>
  </header>
);

export const Stat = ({ value, label }) => (
  <div className="me-stat">
    <b>{value}</b>
    <span>{label}</span>
  </div>
);

export const SectionHead = ({ title, lede, action, rule = true }) => (
  <div className="me-head">
    <div>
      {rule ? <span className="me-head-rule" /> : null}
      <h2>{title}</h2>
      {lede ? <p>{lede}</p> : null}
    </div>
    {action ?? null}
  </div>
);

/* --- tiles --------------------------------------------------------------- */

export const Tile = ({ i = 0, toned = false, className = '', children, ...rest }) => (
  <article className={`me-tile ${toned ? 'me-tile-toned' : ''} ${className}`} style={{ '--i': i }} {...rest}>
    {children}
  </article>
);

/** A tile whose whole face is a photograph. For choices, not for data. */
export const Pathway = ({ to, icon, title, lede, note, art, i = 0 }) => (
  <Link to={to} className="me-pathway" style={{ '--i': i }}>
    <img src={art} alt="" loading="lazy" />
    {icon ? <span className="me-pathway-icon">{icon}</span> : null}
    <h3>{title}</h3>
    {lede ? <p>{lede}</p> : null}
    <span className="me-pathway-go">{note ?? 'Begin'} <ArrowRight size={15} /></span>
  </Link>
);

/* --- the anti-empty-box ------------------------------------------------- */

/**
 * What a surface shows when there is nothing to show. Never a bare message:
 * a picture, a sentence naming what will land here, and a single action.
 * `small` drops the art for places too tight to carry it.
 */
export const ZeroState = ({ title, lede, art, artAlt = '', action, small = false }) => (
  <div className={`me-zero ${small ? 'me-zero-small' : ''}`}>
    <div className="me-zero-copy">
      <h3>{title}</h3>
      {lede ? <p>{lede}</p> : null}
      {action ?? null}
    </div>
    {!small && art ? (
      <div className="me-zero-art">
        <img src={art} alt={artAlt} loading="lazy" />
      </div>
    ) : null}
  </div>
);

/* --- progress ------------------------------------------------------------ */

export const Meter = ({ value = 0 }) => (
  <div className="me-meter" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
    <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

/** Hand-rolled: the project carries no charting library and does not need one. */
export const Ring = ({ value = 0, size = 52, width = 4, label = true }) => {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - width) / 2;
  const len = 2 * Math.PI * r;
  return (
    <div className="me-ring" style={{ width: size, height: size, '--len': len, '--off': len * (1 - pct / 100) }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle className="track" cx={size / 2} cy={size / 2} r={r} strokeWidth={width} />
        <circle className="fill" cx={size / 2} cy={size / 2} r={r} strokeWidth={width} />
      </svg>
      {label ? <b>{Math.round(pct)}%</b> : null}
    </div>
  );
};

/* --- passport ------------------------------------------------------------ */

/**
 * The passport drawn as a thing you hold. An empty one shows its blank pages
 * rather than an apology — the room to fill is the point.
 */
export const PassportBook = ({ holder, role, number, stamps = [], slots = 4, children }) => {
  const blanks = Math.max(0, slots - stamps.length);
  return (
    <div className="me-passport me-passport-sheen">
      <div className="me-passport-in">
        <div className="me-passport-crest">Kingdom Network · Official Record</div>
        <div className="me-passport-holder">
          <b>{holder}</b>
          <span>{role || 'Ministry standing held on this network'}</span>
        </div>
        <div className="me-stamps">
          {stamps.map((s) => (
            <div key={s.key} className="me-stamp me-stamp-filled" title={s.title}>
              {s.icon}
              <b>{s.label}</b>
            </div>
          ))}
          {Array.from({ length: blanks }, (_, n) => (
            <div key={`blank-${n}`} className="me-stamp me-stamp-blank" aria-hidden="true">
              <span style={{ fontSize: 11, letterSpacing: '.06em' }}>—</span>
            </div>
          ))}
        </div>
        {number ? <div className="me-passport-no">{number}</div> : null}
        {children}
      </div>
    </div>
  );
};

/* --- timeline ------------------------------------------------------------ */

/** `state` is 'done' | 'now' | 'todo'. */
export const Steps = ({ steps = [] }) => (
  <div className="me-steps">
    {steps.map((s, i) => (
      <div key={s.key ?? i} className="me-step">
        <span className={`me-step-dot ${s.state === 'now' ? 'me-step-now' : ''} ${s.state === 'done' ? 'me-step-done' : ''}`}>
          {s.icon}
        </span>
        <div className="me-step-copy">
          <b>{s.label}</b>
          {s.detail ? <span>{s.detail}</span> : null}
          {s.action ?? null}
        </div>
      </div>
    ))}
  </div>
);

/* --- rows ---------------------------------------------------------------- */

export const Row = ({ art, artAlt = '', title, meta, end, i = 0 }) => (
  <div className="me-row" style={{ '--i': i }}>
    {art ? <div className="me-row-art"><img src={art} alt={artAlt} loading="lazy" /></div> : null}
    <div className="me-row-main">
      <b className="clamp-1">{title}</b>
      {meta ? <span className="clamp-1">{meta}</span> : null}
    </div>
    {end ? <div className="me-row-end">{end}</div> : null}
  </div>
);

/**
 * A church's mark: its own logo, falling back to the shared placeholder —
 * the convention `ChurchDetail` already set. Never letters derived from the
 * name; a church that uploaded a logo should see it everywhere it appears.
 */

/** The feed's mark, at an arbitrary pixel size. Same drawing as `ui.jsx`. */
export const ChurchMark = ({ church, size = 40, round = true }) => (
  <img
    className="me-mark"
    src={church?.logoImage || CHURCH_PLACEHOLDER}
    alt=""
    width={size}
    height={size}
    loading="lazy"
    style={{ width: size, height: size, borderRadius: round ? 'var(--r-full)' : 'var(--r-md)' }}
    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = CHURCH_PLACEHOLDER; }}
  />
);
