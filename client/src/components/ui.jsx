import { Link } from 'react-router-dom';
import { BadgeCheck, Inbox, Star } from 'lucide-react';

import { compact, money } from '../lib/format.js';

export const Stars = ({ rating = 0, size = 14, showNumber = true, count }) => (
  <span className="row" style={{ gap: 6 }}>
    {showNumber && <span className="rating-num">{rating.toFixed(1)}</span>}
    <span className="stars" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - i + 1));
        return (
          <Star
            key={i}
            size={size}
            strokeWidth={1.5}
            fill={fill > 0.5 ? 'currentColor' : 'none'}
            style={{ opacity: fill > 0.5 ? 1 : 0.35 }}
          />
        );
      })}
    </span>
    {count != null && <span className="xs dim num">({compact(count)})</span>}
  </span>
);

export const Verified = ({ label = 'Verified church', size = 14 }) => (
  <span className="verified xs" title={label}>
    <BadgeCheck size={size} strokeWidth={2} />
    {label}
  </span>
);

/**
 * A church's mark: its logo where it has one, the placeholder church image
 * where it does not.
 *
 * Never initials. Two letters on a tinted square is a stand-in for a picture,
 * not a picture, and it reads as a stray character rather than as a church.
 */
export const CHURCH_PLACEHOLDER = '/media/church-profile-placeholder.jpg';

export const ChurchMark = ({ church, size = '', round = false }) => (
  <img
    className={`monogram monogram-img ${size}`}
    src={church?.logoImage || CHURCH_PLACEHOLDER}
    alt=""
    loading="lazy"
    style={round ? { borderRadius: 'var(--r-full)' } : undefined}
    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = CHURCH_PLACEHOLDER; }}
  />
);

export const PERSON_PLACEHOLDER = '/media/person-placeholder.svg';

/**
 * A person's photograph, or the placeholder portrait when there is none.
 *
 * Never initials. Letters in a box are a stand-in for a picture rather than a
 * picture, and a page of them reads as one repeated pattern — the same reason
 * churches stopped drawing their monogram.
 */
export const Avatar = ({ src, name, size = 36 }) => (
  <img
    className="avatar"
    src={src || PERSON_PLACEHOLDER}
    alt=""
    width={size}
    height={size}
    loading="lazy"
    style={{ width: size, height: size }}
    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = PERSON_PLACEHOLDER; }}
  />
);

export const Price = ({ amount, was, currency = 'USD', size }) => (
  <span className="row" style={{ gap: 8 }}>
    <span className="price" style={size ? { fontSize: size } : undefined}>{money(amount, currency)}</span>
    {was > amount && <span className="price-was">{money(was, currency)}</span>}
  </span>
);

export const Empty = ({ icon: Icon = Inbox, title, children, action }) => (
  <div className="empty">
    <Icon size={30} strokeWidth={1.5} />
    <div className="stack stack-2">
      <h4>{title}</h4>
      {children && <p className="small muted" style={{ maxWidth: '46ch' }}>{children}</p>}
    </div>
    {action}
  </div>
);

export const Spinner = ({ label = 'Loading' }) => (
  <div className="empty" role="status" aria-live="polite">
    <span className="spinner" style={{ color: 'var(--ink-3)' }} />
    <span className="small dim">{label}</span>
  </div>
);

export const ErrorState = ({ error, onRetry }) => (
  <Empty
    title="That did not load"
    action={onRetry && <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>Try again</button>}
  >
    {error?.message ?? 'Something went wrong.'}
  </Empty>
);

export const Breadcrumbs = ({ trail }) => (
  <nav aria-label="Breadcrumb" className="row-wrap xs dim" style={{ gap: 6 }}>
    {trail.map((step, i) => (
      <span key={step.label} className="row" style={{ gap: 6 }}>
        {i > 0 && <span aria-hidden="true">/</span>}
        {step.to ? <Link to={step.to} className="link xs" style={{ color: 'inherit' }}>{step.label}</Link> : <span>{step.label}</span>}
      </span>
    ))}
  </nav>
);

export const SkeletonCard = () => (
  <div className="card" aria-hidden="true">
    <div className="skeleton" style={{ aspectRatio: '3 / 2', borderRadius: 0 }} />
    <div className="card-body stack stack-2">
      <div className="skeleton" style={{ height: 12, width: '55%' }} />
      <div className="skeleton" style={{ height: 16 }} />
      <div className="skeleton" style={{ height: 16, width: '70%' }} />
      <div className="skeleton" style={{ height: 12, width: '40%', marginTop: 8 }} />
    </div>
  </div>
);

export const SkeletonGrid = ({ count = 8, cols = 'grid-4' }) => (
  <div className={`grid ${cols}`}>
    {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
  </div>
);
