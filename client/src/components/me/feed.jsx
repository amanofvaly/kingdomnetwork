import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, BadgeCheck, Check, Plus, Sparkles } from 'lucide-react';

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

export const FollowButton = ({ slug, following, onChange, size = 'btn-sm', variant = 'button' }) => {
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
        className={`me-follow-text ${on ? 'is-on' : ''}`}
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
      >
        {on ? 'Following' : 'Follow'}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`btn ${size} me-follow ${on ? 'btn-outline' : 'btn-primary'}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
    >
      {on ? <><Check size={14} /> Following</> : <><Plus size={14} /> Follow</>}
    </button>
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
    <>
      {total > 0 ? (
        <div className="me-react-summary">
          <span className="me-react-faces">
            {shown.map((r) => <span key={r.type}>{r.emoji}</span>)}
          </span>
          <span>{total}</span>
        </div>
      ) : null}

      <div className="me-react-bar">
        {REACTIONS.map((r) => (
          <button
            key={r.type}
            type="button"
            className={mine === r.type ? 'is-on' : ''}
            onClick={() => choose(r.type)}
            aria-pressed={mine === r.type}
            aria-label={r.label}
          >
            <em aria-hidden="true">{r.emoji}</em>
            <span>{r.label}</span>
          </button>
        ))}
      </div>
    </>
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
      {post.kind === 'credential' ? <span className="me-post-kind me-post-kind-credential"><Award size={12} /> Granted</span> : null}
    </div>
  );
};

export const PostCard = ({ post, onReact }) => (
  <article className="me-post">
    <Head post={post} />

    {post.body ? <div className="me-post-body">{post.body}</div> : null}

    {post.kind === 'credential' && post.credential ? (
      <div className="me-post-cred">
        <span className="me-post-cred-kind"><Award size={13} /> {post.credential.kind.replace(/-/g, ' ')}</span>
        <b>{post.credential.title}</b>
        <span>Granted by {post.church?.name} · {dateShort(post.credential.issuedAt)}</span>
      </div>
    ) : null}

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
    <div className="me-stories">
      {items.map((it) => (
        <Link key={it.key} to={it.to} className="me-story">
          <span className="me-story-ring" style={{ '--pct': it.percent ?? 0 }}>
            <span>{it.image ? <img src={it.image} alt="" /> : it.icon ?? <Sparkles size={20} />}</span>
          </span>
          <small>{it.label}</small>
        </Link>
      ))}
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
      <b className="clamp-1">{church.shortName ?? church.name}</b>
      <span className="clamp-1">
        {church.followers ? `${church.followers} following` : church.city || 'On this network'}
      </span>
    </div>
    <FollowButton slug={church.slug} following={church.following} onChange={onChange} variant="text" />
  </div>
);
