import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useParams } from 'react-router-dom';
import {
  Award, BadgeCheck, BookOpen, Building2, CalendarClock, ClipboardList, Coins, FileText, Gauge,
  GraduationCap, HandCoins, Image, Layers, LogOut, ScrollText, Settings, ShieldCheck, Users, Wallet,
} from 'lucide-react';

import { Spinner } from '../ui.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { useApi } from '../../lib/useAsync.js';


/**
 * The two consoles share a shell: a dark rail naming who you are acting for,
 * and a working area. Which church you are acting for is the most important
 * thing on the screen, because acting on the wrong one is the mistake this
 * layout exists to prevent.
 */

const Rail = ({ title, subtitle, groups, footer, switcher }) => (
  <aside className="console-side">
    <Link to="/" className="console-brand">
      <img src="/brand-mark-white.png" alt="" width="26" height="32" />
      <b>Kingdom Network</b>
    </Link>

    {switcher ?? (
      <div className="console-switch" style={{ cursor: 'default' }}>
        <span className="name">{title}</span>
        <span className="meta">{subtitle}</span>
      </div>
    )}

    <nav className="console-nav">
      {groups.map((group) => (
        <div key={group.label ?? group.items[0].to}>
          {group.label ? <div className="group">{group.label}</div> : null}
          {group.items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'is-active' : '')}>
              {item.icon}
              <span>{item.label}</span>
              {item.count ? <span className="count">{item.count}</span> : null}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>

    <div style={{ marginTop: 'auto' }}>{footer}</div>
  </aside>
);

export const ConsoleHeader = ({ title, sub, children }) => (
  <div className="console-top">
    <div className="grow">
      <h1>{title}</h1>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
    {children}
  </div>
);

/* --- the church console ------------------------------------------------- */

export const ChurchShell = () => {
  const { churchSlug } = useParams();
  const { user, memberships, ready, isPlatformAdmin, logout } = useAuth();
  const [switching, setSwitching] = useState(false);

  const membership = memberships.find((m) => m.churchSlug === churchSlug);
  const { data: overview } = useApi(churchSlug ? `/manage/${churchSlug}/overview` : null, { skip: !churchSlug });

  if (!ready) return <div className="wrap band"><Spinner /></div>;
  if (!user) return <Navigate to="/login" state={{ from: `/manage/${churchSlug}` }} replace />;
  if (user.accountKind !== 'church' && !isPlatformAdmin) return <Navigate to="/dashboard" replace />;
  if (!membership && !isPlatformAdmin) {
    return (
      <div className="wrap band">
        <div className="a-empty">
          <h3>You do not have access to this church</h3>
          <p className="muted small" style={{ maxWidth: 420 }}>
            Ask an administrator of this church to invite you, or set up your own church.
          </p>
          <Link className="btn btn-outline" to="/">Back to Kingdom Network</Link>
        </div>
      </div>
    );
  }

  const base = `/manage/${churchSlug}`;
  const waiting = overview?.stats?.waiting ?? 0;

  const groups = [
    { items: [{ to: base, end: true, label: 'Overview', icon: <Gauge size={16} strokeWidth={1.7} /> }] },
    {
      label: 'Applications',
      items: [
        { to: `${base}/applicants`, label: 'Applicants', icon: <ClipboardList size={16} strokeWidth={1.7} />, count: waiting },
        { to: `${base}/interviews`, label: 'Interviews', icon: <CalendarClock size={16} strokeWidth={1.7} /> },
        { to: `${base}/issued`, label: 'Issued', icon: <Award size={16} strokeWidth={1.7} /> },
      ],
    },
    {
      label: 'Offerings',
      items: [
        { to: `${base}/credentials`, label: 'Credentials', icon: <ScrollText size={16} strokeWidth={1.7} /> },
        { to: `${base}/courses`, label: 'Coursework', icon: <GraduationCap size={16} strokeWidth={1.7} /> },
        { to: `${base}/assessments`, label: 'Papers', icon: <FileText size={16} strokeWidth={1.7} /> },
        { to: `${base}/resources`, label: 'Books', icon: <BookOpen size={16} strokeWidth={1.7} /> },
        { to: `${base}/media`, label: 'Media', icon: <Image size={16} strokeWidth={1.7} /> },
      ],
    },
    {
      label: 'Your page',
      items: [
        { to: `${base}/page`, label: 'Public page', icon: <Layers size={16} strokeWidth={1.7} /> },
        { to: `${base}/donations`, label: 'Giving', icon: <HandCoins size={16} strokeWidth={1.7} /> },
      ],
    },
    {
      label: 'Administration',
      items: [
        { to: `${base}/finance`, label: 'Finance', icon: <Wallet size={16} strokeWidth={1.7} /> },
        { to: `${base}/team`, label: 'Team', icon: <Users size={16} strokeWidth={1.7} /> },
        { to: `${base}/settings`, label: 'Settings', icon: <Settings size={16} strokeWidth={1.7} /> },
      ],
    },
  ];

  const church = membership?.church ?? overview?.church;

  return (
    <div className="console">
      <Rail
        groups={groups}
        switcher={
          <>
            <button
              type="button"
              className="console-switch"
              onClick={() => setSwitching((v) => !v)}
              aria-expanded={switching}
            >
              <span className="name">{church?.name ?? church?.shortName ?? churchSlug}</span>
              <span className="meta">
                {isPlatformAdmin && !membership ? 'Platform administrator' : membership?.role}
                {church?.verified ? ' · verified' : ''}
              </span>
            </button>
            {switching && memberships.length > 1 ? (
              <div className="stack stack-1" style={{ paddingLeft: 8 }}>
                {memberships
                  .filter((m) => m.churchSlug !== churchSlug)
                  .map((m) => (
                    <Link key={m.churchSlug} to={`/manage/${m.churchSlug}`} className="small" style={{ color: 'var(--ink-inverse-2)' }}>
                      {m.church?.shortName ?? m.churchSlug}
                    </Link>
                  ))}
              </div>
            ) : null}
          </>
        }
        footer={
          <nav className="console-nav">
            {church?.slug ? (
              <Link to={`/churches/${church.slug}`} target="_blank" rel="noopener noreferrer">
                <Building2 size={16} strokeWidth={1.7} />
                <span>View public page</span>
              </Link>
            ) : null}
            <button type="button" onClick={logout} className="console-nav-out" style={{ all: 'unset', cursor: 'pointer', width: '100%' }}>
              <span
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--s-3)', padding: '9px var(--s-3)',
                  borderRadius: 'var(--r-md)', color: 'var(--ink-inverse-2)', fontSize: 'var(--text-sm)',
                }}
              >
                <LogOut size={16} strokeWidth={1.7} />
                Sign out
              </span>
            </button>
          </nav>
        }
      />
      <main className="console-main">
        <Outlet context={{ churchSlug, membership, church }} />
      </main>
    </div>
  );
};

/* --- the platform console ----------------------------------------------- */

export const AdminShell = () => {
  const { user, ready, isPlatformAdmin, logout } = useAuth();
  const { data: overview } = useApi(isPlatformAdmin ? '/admin/overview' : null, { skip: !isPlatformAdmin });

  if (!ready) return <div className="wrap band"><Spinner /></div>;
  if (!user) return <Navigate to="/login" state={{ from: '/admin' }} replace />;
  if (!isPlatformAdmin) {
    return (
      <div className="wrap band">
        <div className="a-empty">
          <h3>Platform administrators only</h3>
          <Link className="btn btn-outline" to="/">Back to Kingdom Network</Link>
        </div>
      </div>
    );
  }

  const groups = [
    { items: [{ to: '/admin', end: true, label: 'Overview', icon: <Gauge size={16} strokeWidth={1.7} /> }] },
    {
      label: 'The network',
      items: [
        { to: '/admin/churches', label: 'Churches', icon: <Building2 size={16} strokeWidth={1.7} /> },
        {
          to: '/admin/verification',
          label: 'Verification',
          icon: <BadgeCheck size={16} strokeWidth={1.7} />,
          count: overview?.counts?.pendingVerification,
        },
        { to: '/admin/users', label: 'People', icon: <Users size={16} strokeWidth={1.7} /> },
        { to: '/admin/applications', label: 'Applications', icon: <ClipboardList size={16} strokeWidth={1.7} /> },
      ],
    },
    {
      label: 'Money',
      items: [
        { to: '/admin/payments', label: 'Payments', icon: <Coins size={16} strokeWidth={1.7} /> },
        { to: '/admin/settlements', label: 'Settlements', icon: <Wallet size={16} strokeWidth={1.7} /> },
      ],
    },
    {
      label: 'The platform',
      items: [
        { to: '/admin/merchandising', label: 'Merchandising', icon: <ScrollText size={16} strokeWidth={1.7} /> },
        { to: '/admin/settings', label: 'Settings', icon: <Settings size={16} strokeWidth={1.7} /> },
        { to: '/admin/audit', label: 'Audit trail', icon: <ShieldCheck size={16} strokeWidth={1.7} /> },
      ],
    },
  ];

  return (
    <div className="console">
      <Rail
        title="Kingdom Network"
        subtitle="Platform administration"
        groups={groups}
        footer={
          <nav className="console-nav">
            <button type="button" onClick={logout} style={{ all: 'unset', cursor: 'pointer', width: '100%' }}>
              <span
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--s-3)', padding: '9px var(--s-3)',
                  borderRadius: 'var(--r-md)', color: 'var(--ink-inverse-2)', fontSize: 'var(--text-sm)',
                }}
              >
                <LogOut size={16} strokeWidth={1.7} />
                Sign out
              </span>
            </button>
          </nav>
        }
      />
      <main className="console-main">
        <Outlet />
      </main>
    </div>
  );
};
