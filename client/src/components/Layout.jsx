import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown, Compass, IdCard, LayoutDashboard, LogOut, Menu, Search, ShieldCheck, ShoppingBag, X,
} from 'lucide-react';

import { api } from '../lib/api.js';
import { money } from '../lib/format.js';

import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { useCart } from '../lib/cart.jsx';
import { Avatar, ChurchMark } from './ui.jsx';

// Two flows, then the issuers. Credentials are applied for, learning is
// bought, and churches are who stands behind both.
const NAV = [
  { to: '/credentials', label: 'Credentials' },
  { to: '/learning', label: 'Learning' },
  { to: '/churches', label: 'Churches' },
];

const SearchField = ({ compactMode }) => {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState(null);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (term.trim().length < 2) { setHits(null); return undefined; }
    const controller = new AbortController();
    const t = setTimeout(() => {
      api.get(`/suggest?q=${encodeURIComponent(term.trim())}`, { signal: controller.signal })
        .then(setHits)
        .catch(() => {});
    }, 180);
    return () => { clearTimeout(t); controller.abort(); };
  }, [term]);

  useEffect(() => {
    const onDown = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const go = (to) => { setOpen(false); setTerm(''); navigate(to); };
  const any = hits && (hits.outcomes.length || hits.offerings.length || hits.churches.length);

  return (
    <div ref={box} style={{ position: 'relative', width: '100%' }}>
      <form
        className="search"
        role="search"
        onSubmit={(e) => { e.preventDefault(); if (term.trim()) go(`/search?q=${encodeURIComponent(term.trim())}`); }}
      >
        <Search size={17} strokeWidth={1.8} color="var(--ink-3)" />
        <input
          type="search"
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={compactMode ? 'Search credentials, churches, destinations' : 'Search credentials and churches'}
          aria-label="Search credentials and churches"
        />
      </form>

      {open && any && (
        <div className="suggest" role="listbox">
          {hits.outcomes.length > 0 && (
            <>
              <div className="suggest-group">Browse</div>
              {hits.outcomes.map((o) => (
                <button key={o.slug} type="button" className="suggest-item" onClick={() => go(`/${o.slug}`)}>
                  <Compass size={16} color="var(--ink-3)" />
                  <span className="small">{o.verb} <span className="dim">· {o.name}</span></span>
                </button>
              ))}
            </>
          )}
          {hits.offerings.length > 0 && (
            <>
              <div className="suggest-group">Listings</div>
              {hits.offerings.map((o) => (
                <button key={o.slug} type="button" className="suggest-item" onClick={() => go(`/listing/${o.slug}`)}>
                  <ChurchMark church={o.church} size="monogram-sm" />
                  <span className="small grow clamp-1">
                    {o.title}
                    <span className="dim"> · {o.church?.shortName ?? ''}</span>
                  </span>
                  <span className="price small strong">{money(o.price)}</span>
                </button>
              ))}
            </>
          )}
          {hits.churches.length > 0 && (
            <>
              <div className="suggest-group">Churches</div>
              {hits.churches.map((c) => (
                <button key={c.slug} type="button" className="suggest-item" onClick={() => go(`/churches/${c.slug}`)}>
                  <ChurchMark church={c} size="monogram-sm" />
                  <span className="small grow clamp-1">{c.name}<span className="dim"> · {c.country}</span></span>
                </button>
              ))}
            </>
          )}
          <button type="button" className="suggest-item" onClick={() => go(`/search?q=${encodeURIComponent(term.trim())}`)}>
            <Search size={16} color="var(--ink-3)" />
            <span className="small">See all results for “{term.trim()}”</span>
          </button>
        </div>
      )}
    </div>
  );
};

/** Anywhere a signed-out visitor has no business being. */
const PRIVATE = /^\/(me|manage|admin|applications|checkout)\b/;

const AccountMenu = () => {
  const { user, logout, memberships, isPlatformAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { ok } = useToast();

  /**
   * Signing out cleared the session but said nothing, and navigating home from
   * home is invisible — so on the front page it looked like the button did
   * nothing at all.
   */
  const signOut = () => {
    logout();
    setOpen(false);
    if (PRIVATE.test(pathname)) navigate('/', { replace: true });
    ok('Signed out');
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="row" style={{ gap: 8, padding: 4 }} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        <Avatar src={user.avatar} name={user.name} size={32} />
        <ChevronDown size={15} color="var(--ink-3)" />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <div className="strong small">{user.name}</div>
            <div className="xs dim">{user.email}</div>
          </div>
          {user.accountKind !== 'church' ? (
            <Link to="/me" onClick={() => setOpen(false)}><IdCard size={16} /> Your area</Link>
          ) : null}

          {/* Only a church account can enter the console. A personal account may
              still hold a membership — accepting a team invite is a personal
              action — but the console turns it away, so offering the link would
              be offering a second route to the page it just came from. */}
          {user.accountKind === 'church'
            ? memberships.map((m) => (
              <Link key={m.churchSlug} to={`/manage/${m.churchSlug}`} onClick={() => setOpen(false)}>
                <LayoutDashboard size={16} /> {m.church?.name ?? 'Church dashboard'}
              </Link>
            ))
            : null}
          {isPlatformAdmin ? (
            <Link to="/admin" onClick={() => setOpen(false)}><ShieldCheck size={16} /> Platform administration</Link>
          ) : null}
          <button type="button" onClick={signOut}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
};

const MobileNav = ({ onClose }) => {
  const { user, memberships, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { ok } = useToast();
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg)' }}>
      <div className="wrap">
        <div className="row-between" style={{ height: 'var(--header-h)' }}>
          <Link to="/" className="brand" onClick={onClose}>
            <img className="brand-mark" src="/brand-mark.png" alt="" width="26" height="32" />
            <span className="brand-name">Kingdom Network</span>
          </Link>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>
        <div className="stack stack-5" style={{ paddingTop: 'var(--s-4)' }}>
          <SearchField />
          <nav className="stack stack-1">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} onClick={onClose} className="sheet-link">{item.label}</NavLink>
            ))}
            <NavLink to="/verify" onClick={onClose} className="sheet-link">Verify a credential</NavLink>
            {user && user.accountKind !== 'church' ? (
              <NavLink to="/me" onClick={onClose} className="sheet-link">Your area</NavLink>
            ) : null}
            {user?.accountKind === 'church' && memberships[0] ? (
              <NavLink to={`/manage/${memberships[0].churchSlug}`} onClick={onClose} className="sheet-link">Church dashboard</NavLink>
            ) : null}
          </nav>
          {user ? (
            <button type="button" className="btn btn-outline btn-block"
              onClick={() => { logout(); onClose(); if (PRIVATE.test(pathname)) navigate('/', { replace: true }); ok('Signed out'); }}>
              Sign out
            </button>
          ) : (
            <div className="stack stack-3">
              <Link to="/login" className="btn btn-primary btn-block" onClick={onClose}>Sign in</Link>
              <Link to="/church/register" className="church-register-link" onClick={onClose}>Register church</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Header = () => {
  const { user, memberships, ready } = useAuth();
  const { count } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const churchDashboard = memberships[0]?.churchSlug ?? user?.churchSlug;

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      <header className="header">
        <div className="wrap header-inner">
          <Link to="/" className="brand">
            <img className="brand-mark" src="/brand-mark.png" alt="" width="26" height="32" />
            <span className="brand-name">Kingdom Network</span>
          </Link>

          <nav className="nav" aria-label="Main">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="header-search grow"><SearchField compactMode /></div>

          <div className="row" style={{ gap: 4, marginLeft: 'auto' }}>
            <Link to="/cart" className="icon-btn" aria-label={`Basket, ${count} items`}>
              <ShoppingBag size={19} strokeWidth={1.7} />
              {count > 0 && <span className="cart-count">{count}</span>}
            </Link>

            {ready && (user ? (
              user.accountKind === 'church' ? (
                churchDashboard ? (
                  <Link to={`/manage/${churchDashboard}`} className="btn btn-primary btn-sm hide-on-narrow">
                    Dashboard
                  </Link>
                ) : null
              ) : (
                <>
                  <Link to="/me/passport" className="btn btn-ghost btn-sm hide-on-narrow">My passport</Link>
                  <AccountMenu />
                </>
              )
            ) : (
              <div className="row" style={{ gap: 8 }}>
                <Link to="/church/register" className="church-register-link hide-on-narrow">Register church</Link>
                <Link to="/login" className="btn btn-primary btn-sm hide-on-narrow">Sign in</Link>
              </div>
            ))}

            {ready && !user ? (
              <Link to="/login" className="btn btn-primary btn-sm church-entry-mobile">
                Sign in
              </Link>
            ) : null}

            <button type="button" className="icon-btn hide-lg" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>
      {mobileOpen && <MobileNav onClose={() => setMobileOpen(false)} />}
    </>
  );
};

const Footer = () => (
  <footer className="footer">
    <div className="wrap">
      <div className="footer-grid">
        <div className="stack stack-3">
          <Link to="/" className="brand">
            <img className="brand-mark" src="/brand-mark-white.png" alt="" width="26" height="32" />
            <span className="brand-name" style={{ color: '#fff' }}>Kingdom Network</span>
          </Link>
          <p className="small footer-blurb">
            A global network of churches empowering ministers for international service.
          </p>
        </div>
        <div>
          <h5>Learn</h5>
          <ul>
            <li><Link to="/ordination">Ordination</Link></li>
            <li><Link to="/certification">Certificates</Link></li>
            <li><Link to="/ministry-license">Licences</Link></li>
            <li><Link to="/church-affiliation">Affiliation</Link></li>
          </ul>
        </div>
        <div>
          <h5>More</h5>
          <ul>
            <li><Link to="/invitation-letter">Invitation letters</Link></li>
            <li><Link to="/learning">Learning</Link></li>
            <li><Link to="/churches">Church directory</Link></li>
            <li><Link to="/verify">Verify a credential</Link></li>
          </ul>
        </div>
        <div>
          <h5>Account</h5>
          <ul>
            <li><Link to="/signup">Create an account</Link></li>
            <li><Link to="/login">Sign in</Link></li>
            <li><Link to="/me">Your area</Link></li>
            <li><Link to="/me/passport">Minister passport</Link></li>
            <li><Link to="/me/journey">Your journey</Link></li>
          </ul>
        </div>
        <div>
          <h5>For churches</h5>
          <ul>
            <li><Link to="/church/register">Register your church</Link></li>
            <li><Link to="/for-churches">How Kingdom Network works</Link></li>
            <li><Link to="/churches">Church directory</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Kingdom Network</span>
        <span>“To equip the saints for the work of ministry, for building up the body of Christ.” — Ephesians 4:12</span>
      </div>
    </div>
  </footer>
);

export const Layout = () => (
  <div className="shell">
    <Header />
    <main><Outlet /></main>
    <Footer />
  </div>
);
