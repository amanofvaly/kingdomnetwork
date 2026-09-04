import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BadgeCheck, Check, Plus, Sparkles } from 'lucide-react';

import { Avatar } from '../ui.jsx';
import { ChurchMark } from './kit.jsx';
import { api } from '../../lib/api.js';
import { dateShort } from '../../lib/format.js';

/**
 * The feed, and the two things you can do to it: react, and follow.
 *
 * Both are optimistic. A reaction that waits for a round trip before it moves
 * feels broken on a phone, so the button changes immediately and only rolls
 * back if the server disagrees.
 */

export const REACTIONS = [
  { type: 'amen', emoji: '🙌', label: 'Amen' },
  { type: 'pray', emoji: '🙏', label: 'Pray' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'celebrate', emoji: '🎉', label: 'Celebrate' },
];

/** "3h", "2d", then a date — the units people actually read in a feed. */
const since = (value) => {
  if (!value) return '';
  const mins = Math.floor((Date.now() - new Date(value)) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return dateShort(value);
};

/* --- follow -------------------------------------------------------------- */

export const FollowButton = ({ slug, following, onChange, size = 'btn-sm', variant = 'button', inverse = false, style, className = '' }) => {
  const [on, setOn] = useState(following);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    const next = !on;
    setOn(next);
    setBusy(true);
    try {
      if (next) await api.post(`/me/follow/${slug}`);
      else await api.del(`/me/follow/${slug}`);
      onChange?.(slug, next);
    } catch {
      setOn(!next);
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'text') {
    return (
      <button
        type="button"
        className={`me-follow-text ${on ? 'is-on' : ''} ${className}`}
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        style={style}
      >
        {on ? 'Following' : 'Follow'}
      </button>
    );
  }

  // On a cover photograph the unfollowed state is still the bright blue —
  // it is the one thing on the header meant to be pressed. Only the followed
  // state goes to a white outline, which is what stays readable over a photo.
  const skin = on
    ? (inverse ? 'btn-inverse-outline' : 'btn-outline')
    : 'btn-primary';

  return (
    <button
      type="button"
      className={`btn ${size} me-follow ${skin} ${className}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      style={style}
    >
      {on ? <><Check size={14} /> Following</> : <><Plus size={14} /> Follow</>}
    </button>
  );
};


/**
 * The seal from the printed certificate, drawn small enough to sit in a pill.
 * A generic award icon says "achievement"; this says "issued under seal",
 * which is the specific thing that happened.
 */
const Seal = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="10" r="6.4" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="12" cy="10" r="3.6" stroke="currentColor" strokeWidth="1" opacity=".65" />
    <path d="M8.3 15.4 6.8 22l5.2-2.6 5.2 2.6-1.5-6.6" stroke="currentColor" strokeWidth="1.5"
      strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

/** The certificate itself, laid out the way `server/lib/documents.js` prints it. */
const DOC_TYPE = {
  ordination: 'Certificate of Ordination',
  license: 'Certificate of Licensing',
  certificate: 'Certificate',
  diploma: 'Diploma',
  'letter-of-standing': 'Letter of Standing',
  affiliation: 'Certificate of Affiliation',
};

const longDate = (v) =>
  v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const Certificate = ({ credential: c }) => {
  const church = c.church ?? {};
  const place = [church.city, church.country].filter(Boolean).join(', ');
  const signatory = church.signatory;

  return (
    <div className="me-cert">
      <div className="me-cert-doc">
        <div className="me-cert-issuer">{church.name ?? 'Issuing church'}</div>
        {place ? <div className="me-cert-place">{place}</div> : null}
        <span className="me-cert-rule" />

        <div className="me-cert-doctype">{DOC_TYPE[c.kind] ?? 'Certificate'}</div>
        <h3 className="me-cert-title">{c.title}</h3>

        <div className="me-cert-certify">This is to certify that</div>
        <div className="me-cert-holder">{c.holderName}</div>
        <span className="me-cert-rule me-cert-rule-wide" />

        <p className="me-cert-body">
          has satisfied the requirements set by {church.name ?? 'the issuing church'} and is granted
          this credential in good standing as of {longDate(c.issuedAt)}.
        </p>

        <div className="me-cert-seal">
          <b>{church.monogram ?? 'KN'}</b>
          <small>ISSUED UNDER SEAL</small>
        </div>

        <div className="me-cert-foot">
          <span className="me-cert-sign">
            <b>{signatory?.name ?? 'Authorised signatory'}</b>
            <span>{signatory?.title ?? 'For the issuing church'}</span>
          </span>
          <span className="me-cert-sign me-cert-sign-end">
            <b>{c.credentialId}</b>
            <span>Issued {longDate(c.issuedAt)}</span>
          </span>
        </div>

        <div className="me-cert-verify">
          Verify at kingdom.network/verify/{c.verifyCode ?? ''}
        </div>
      </div>
    </div>
  );
};

/* --- reactions ----------------------------------------------------------- */

const ReactionBar = ({ post, onReact }) => {
  const [mine, setMine] = useState(post.myReaction);
  const [counts, setCounts] = useState(post.reactionCounts ?? {});
  const [total, setTotal] = useState(post.reactionTotal ?? 0);

  const choose = async (type) => {
    const next = mine === type ? null : type;
    const before = { mine, counts, total };

    // Move now; reconcile with the server's numbers when they arrive.
    const optimistic = { ...counts };
    if (mine) optimistic[mine] = Math.max(0, (optimistic[mine] ?? 0) - 1);
    if (next) optimistic[next] = (optimistic[next] ?? 0) + 1;
    setMine(next);
    setCounts(optimistic);
    setTotal(total + (next ? 1 : 0) - (mine ? 1 : 0));

    try {
      const data = await api.post(`/me/posts/${post.id}/react`, { type: next });
      setCounts(data.reactionCounts);
      setTotal(data.reactionTotal);
      onReact?.(post.id, data);
    } catch {
      setMine(before.mine);
      setCounts(before.counts);
      setTotal(before.total);
    }
  };

  const shown = REACTIONS.filter((r) => (counts[r.type] ?? 0) > 0).slice(0, 3);

  return (
    <div className="me-react-bar">
      {REACTIONS.map((r) => (
        <button
          key={r.type}
          type="button"
          className={mine === r.type ? 'is-on' : ''}
          onClick={() => choose(r.type)}
          aria-pressed={mine === r.type}
          aria-label={mine === r.type ? `${r.label} — yours, tap to remove` : r.label}
        >
          <em aria-hidden="true">{r.emoji}</em>
          <span>{r.label}</span>
        </button>
      ))}

      {total > 0 ? (
        <span className="me-react-count">
          <span className="me-react-faces">
            {shown.map((r) => <span key={r.type}>{r.emoji}</span>)}
          </span>
          {total}
        </span>
      ) : null}
    </div>
  );
};

/* --- a post -------------------------------------------------------------- */

const Head = ({ post }) => {
  const a = post.author;
  if (!a) return null;

  const isChurch = a.kind === 'church';
  const name = isChurch ? (a.shortName ?? a.name) : a.name;
  const meta = isChurch
    ? since(post.publishedAt)
    : `${a.role ? `${a.role} · ` : ''}${since(post.publishedAt)}`;

  return (
    <div className="me-post-head">
      {isChurch
        ? <Link to={`/churches/${a.slug}`} aria-label={a.name}><ChurchMark church={a} size={38} /></Link>
        : <Avatar src={a.avatar} name={a.name} size={38} />}

      <div className="me-post-who">
        <b>
          {isChurch ? <Link to={`/churches/${a.slug}`}>{name}</Link> : name}
          {isChurch && a.verified ? <BadgeCheck size={14} fill="currentColor" color="#fff" /> : null}
        </b>
        <span className="me-post-when">{meta}</span>
      </div>

      {post.kind === 'offering' ? <span className="me-post-kind me-post-kind-offering">New</span> : null}
      {post.kind === 'credential' ? <span className="me-post-kind me-post-kind-credential"><Seal size={13} /> Granted</span> : null}
    </div>
  );
};

export const PostCard = ({ post, onReact }) => (
  <article className="me-post">
    <Head post={post} />

    {post.body ? <div className="me-post-body">{post.body}</div> : null}

    {post.kind === 'credential' && post.credential ? <Certificate credential={post.credential} /> : null}

    {post.images?.length ? (
      <div className={`me-post-media me-post-media-${Math.min(post.images.length, 2)}`}>
        {post.images.slice(0, 2).map((img) => (
          <img key={img.url} src={img.url} alt={img.alt ?? ''} loading="lazy" />
        ))}
      </div>
    ) : null}

    {post.kind === 'offering' && post.offering ? (
      <Link to={`/listing/${post.offering.slug}`} className="me-post-card">
        {post.offering.coverImage ? (
          <span className="me-post-card-art"><img src={post.offering.coverImage} alt="" loading="lazy" /></span>
        ) : null}
        <span className="me-post-card-copy">
          <b className="clamp-2">{post.offering.title}</b>
          <span>{post.church?.shortName ?? post.church?.name} · see what is involved</span>
        </span>
      </Link>
    ) : null}

    <ReactionBar post={post} onReact={onReact} />
  </article>
);

/* --- what you have open, across the top ---------------------------------- */

export const StoryRail = ({ items }) => {
  if (!items.length) return null;
  return (
    <div className="me-reels">
      {items.map((it) => (
        <Link key={it.key} to={it.to} className="me-reel" style={{ '--pct': it.percent ?? 0 }}>
          <span className="me-reel-art">
            {it.image ? <img src={it.image} alt="" loading="lazy" /> : it.icon ?? <Sparkles size={22} />}
          </span>
          {it.image ? <span className="me-reel-kind">{it.icon ?? <Sparkles size={13} />}</span> : null}
          <span className="me-reel-copy">
            <span className="me-reel-label">{it.label}</span>
            {it.action ? (
              <span className={`me-reel-do ${it.waiting ? 'is-waiting' : ''} ${it.starter ? 'is-starter' : ''}`}>
                {it.action}
              </span>
            ) : null}
          </span>
          {it.starter ? null : <span className="me-reel-bar"><span /></span>}
        </Link>
      ))}

      {/* Only when the rail is short enough that the card is filling space
          rather than taking it. A full rail explains itself. */}
      {items.length < 4 ? (
        <div className="me-reel me-reel-hint" aria-hidden="true">
          {/* Three blanks in the shape of the real cards, waiting to be dealt. */}
          <span className="me-reel-hint-deck">
            <span /><span /><span />
          </span>
          <span className="me-reel-hint-copy">Your pending actions show up here</span>
        </div>
      ) : null}

      {/* Two ways on, drawn as opposites: a sealed document on a dark field,
          and a stack of lessons on a light one. Neither wears the vocabulary
          of a task card, so neither can be mistaken for work you owe. */}
      <Link to="/credentials" className="me-promo me-promo-cred">
        <span className="me-promo-art" aria-hidden="true">
          <span className="me-promo-doc"><i /><i /><i /><em /></span>
        </span>
        <span className="me-promo-copy">
          <span className="me-promo-kicker">Credentials</span>
          <strong>Get recognised</strong>
        </span>
        <ArrowUpRight className="me-promo-go" size={17} strokeWidth={2.4} />
      </Link>

      <Link to="/courses" className="me-promo me-promo-course">
        <span className="me-promo-art" aria-hidden="true">
          <span className="me-promo-shelf"><i /><i /><i /><i /></span>
        </span>
        <span className="me-promo-copy">
          <span className="me-promo-kicker">Courses</span>
          <strong>Learn the work</strong>
        </span>
        <ArrowUpRight className="me-promo-go" size={17} strokeWidth={2.4} />
      </Link>
    </div>
  );
};

/* --- churches worth following -------------------------------------------- */

export const SuggestionRow = ({ church, onChange }) => (
  <div className="me-suggest-row">
    <Link to={`/churches/${church.slug}`} aria-label={church.name}>
      <ChurchMark church={church} size={38} />
    </Link>
    <div className="me-suggest-copy grow">
      <Link to={`/churches/${church.slug}`} className="clamp-1" style={{ fontWeight: 'bold' }}>
        {church.shortName ?? church.name}
      </Link>
      <span className="clamp-1">
        {church.followers ? `${church.followers} following` : church.city || 'On this network'}
      </span>
    </div>
    <FollowButton slug={church.slug} following={church.following} onChange={onChange} variant="text" />
  </div>
);
