import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ArrowUpRight, Bell, BookOpen, HandCoins, Home, IdCard, Library,
  LogOut, Menu, Route as RouteIcon, Settings as SettingsIcon, User, X,
} from 'lucide-react';

import { Avatar } from '../ui.jsx';
import { toneStyle } from './kit.jsx';
import { useApi } from '../../lib/useAsync.js';
import { useAuth } from '../../lib/auth.jsx';
import { Gate } from '../../lib/guard.jsx';

/**
 * The shell of the user area.
 *
 * Deliberately not the console shell at /admin and /manage. Those exist to
 * make someone administering an organisation careful; this exists to make
 * someone feel they have arrived somewhere of their own. Same family of
 * colour, opposite job — so it is roomier, warmer, and the art is allowed to
 * reach the edges.
 */

const ICON = { size: 18, strokeWidth: 1.7 };

const PRIMARY = [
  { to: '/me', end: true, key: 'home', label: 'Home', icon: <Home {...ICON} /> },
  { to: '/me/journey', key: 'journey', label: 'Journey', icon: <RouteIcon {...ICON} /> },
  { to: '/me/passport', key: 'passport', label: 'Digital Passport', icon: <IdCard {...ICON} /> },
  { to: '/me/learning', key: 'learning', label: 'Learning', icon: <BookOpen {...ICON} /> },
  { to: '/me/library', key: 'library', label: 'Library', icon: <Library {...ICON} /> },
  { to: '/me/giving', key: 'giving', label: 'Giving', icon: <HandCoins {...ICON} /> },
];

const SECONDARY = [
  { to: '/me/inbox', key: 'inbox', label: 'Inbox', icon: <Bell {...ICON} /> },
  { to: '/me/profile', key: 'profile', label: 'Profile', icon: <User {...ICON} /> },
  { to: '/me/settings', key: 'settings', label: 'Settings', icon: <SettingsIcon {...ICON} /> },
];

const TITLES = {
  home: 'Home', journey: 'Your journey', passport: 'Digital Passport', learning: 'Learning',
  library: 'Library', giving: 'Giving', inbox: 'Inbox', profile: 'Profile', settings: 'Settings',
};

/** Which section are we in? Drives both the top-bar title and the tone. */
const sectionOf = (pathname) => {
  const rest = pathname.replace(/^\/me\/?/, '').split('/')[0];
  return rest && TITLES[rest] ? rest : 'home';
};

const navClass = ({ isActive }) => (isActive ? 'is-active' : '');

const MeChrome = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);

  const section = sectionOf(location.pathname);

  // Already built, already counted, and until now never shown to anyone.
  const { data: notes } = useApi('/me/notifications');
  const unread = notes?.unread ?? 0;

  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  const item = (it) => (
    <NavLink key={it.to} to={it.to} end={it.end} className={navClass}>
      {it.icon}
      <span>{it.label}</span>
      {it.key === 'inbox' && unread ? <span className="count">{unread > 99 ? '99+' : unread}</span> : null}
    </NavLink>
  );

  return (
    <div className="me" style={toneStyle(section)}>
      <aside className="me-rail">
        <Link to="/" className="me-rail-brand">
          <img src="/brand-mark-white.png" alt="" width="22" height="27" />
          <span>Kingdom Network</span>
        </Link>

        <div className="me-identity">
          <Avatar src={user.avatar} name={user.name} size={40} />
          <div style={{ minWidth: 0 }}>
            <div className="me-identity-name clamp-1">{user.name}</div>
            <div className="me-identity-role clamp-1">{user.ministryRole || 'Your ministry'}</div>
          </div>
        </div>

        <nav className="me-nav">
          {PRIMARY.map(item)}
          <div className="me-nav-group">Account</div>
          {SECONDARY.map(item)}
        </nav>

        <div className="me-rail-foot">
          <button type="button" className="me-signout" onClick={logout}>
            <LogOut {...ICON} /> <span>Sign out</span>
          </button>
          <Link to="/" className="me-rail-exit">Back to Kingdom Network →</Link>
        </div>
      </aside>

      <div className="me-main">
        <div className="me-top">
          <button type="button" className="icon-btn me-burger" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <span className="me-top-title">{TITLES[section]}</span>
          <div className="me-top-actions">
            <Link to="/me/inbox" className="icon-btn me-bell" aria-label={unread ? `Inbox, ${unread} unread` : 'Inbox'}>
              <Bell size={19} strokeWidth={1.7} />
              {unread ? <span className="me-bell-dot" /> : null}
            </Link>
            <Link to="/me/profile" aria-label="Your profile" style={{ display: 'flex' }}>
              <Avatar src={user.avatar} name={user.name} size={32} />
            </Link>
          </div>
        </div>

        <Outlet />
      </div>

      <nav className="me-tabs" aria-label="Sections">
        {PRIMARY.slice(0, 4).map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={navClass}>
            {it.icon}
            <span>{it.label}</span>
          </NavLink>
        ))}
        <button type="button" onClick={() => setDrawer(true)}>
          <Menu {...ICON} />
          <span>More</span>
          {unread ? <span className="count">{unread > 9 ? '9+' : unread}</span> : null}
        </button>
      </nav>

      {drawer ? (
        <>
          <button type="button" className="me-scrim" aria-label="Close menu" onClick={() => setDrawer(false)} />
          <div className="me-drawer" role="dialog" aria-label="Menu">
            <span className="me-grip" aria-hidden="true" />

            <div className="me-sheet-head">
              <Avatar src={user.avatar} name={user.name} size={38} />
              <div style={{ minWidth: 0 }}>
                <div className="me-identity-name clamp-1">{user.name}</div>
                <div className="me-identity-role clamp-1">{user.email}</div>
              </div>
              <button type="button" className="icon-btn" onClick={() => setDrawer(false)}
                aria-label="Close menu" style={{ marginLeft: 'auto', color: '#fff' }}>
                <X size={20} />
              </button>
            </div>

            <nav className="me-sheet-grid">
              {[...PRIMARY, ...SECONDARY].map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} className={navClass} onClick={() => setDrawer(false)}>
                  {it.icon}
                  <span>{it.label}</span>
                  {it.key === 'inbox' && unread ? (
                    <span className="count">{unread > 99 ? '99+' : unread}</span>
                  ) : null}
                </NavLink>
              ))}
            </nav>

            <div className="me-sheet-foot">
              <Link to="/" onClick={() => setDrawer(false)}>
                <ArrowUpRight {...ICON} /> <span>Kingdom Network</span>
              </Link>
              <button type="button" onClick={logout}>
                <LogOut {...ICON} /> <span>Sign out</span>
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export const MeShell = () => (
  <Gate kind="personal">
    <MeChrome />
  </Gate>
);
