import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen, ChevronDown, IdCard, LogOut, Menu, Search, ShoppingBag, User, X,
} from 'lucide-react';

import { useAuth } from '../lib/auth.jsx';
import { useCart } from '../lib/cart.jsx';
import { Avatar } from './ui.jsx';

const NAV = [
  { to: '/courses', label: 'Courses' },
  { to: '/pathways', label: 'Pathways' },
  { to: '/churches', label: 'Churches' },
];

const SearchField = ({ compactMode }) => {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');

  return (
    <form
      className="search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (term.trim()) navigate(`/courses?q=${encodeURIComponent(term.trim())}`);
      }}
    >
      <Search size={17} strokeWidth={1.8} color="var(--ink-3)" />
      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={compactMode ? 'Search' : 'Search courses, credentials and churches'}
        aria-label="Search the marketplace"
      />
    </form>
  );
};

const AccountMenu = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

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
          <Link to="/dashboard" onClick={() => setOpen(false)}><BookOpen size={16} /> My learning</Link>
          <Link to="/passport" onClick={() => setOpen(false)}><IdCard size={16} /> Minister passport</Link>
          <Link to="/account" onClick={() => setOpen(false)}><User size={16} /> Account</Link>
          <Link to="/orders" onClick={() => setOpen(false)}><ShoppingBag size={16} /> Orders</Link>
          <div className="menu-sep" />
          <button type="button" onClick={() => { logout(); setOpen(false); navigate('/'); }}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
};

const MobileNav = ({ onClose }) => {
  const { user, logout } = useAuth();
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg)' }}>
      <div className="wrap">
        <div className="row-between" style={{ height: 'var(--header-h)' }}>
          <Link to="/" className="brand" onClick={onClose}>
            <span className="brand-mark">K</span>
            <span className="brand-name">Kingdom Network</span>
          </Link>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>
        <div className="stack stack-5" style={{ paddingTop: 'var(--s-4)' }}>
          <SearchField />
          <nav className="stack stack-1">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} onClick={onClose}
                style={{ padding: '14px 0', fontSize: 'var(--text-xl)', fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.02em', borderBottom: '1px solid var(--line)' }}>
                {item.label}
              </NavLink>
            ))}
            {user && (
              <>
                <NavLink to="/dashboard" onClick={onClose} style={{ padding: '14px 0', fontSize: 'var(--text-xl)', fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.02em', borderBottom: '1px solid var(--line)' }}>My learning</NavLink>
                <NavLink to="/passport" onClick={onClose} style={{ padding: '14px 0', fontSize: 'var(--text-xl)', fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.02em', borderBottom: '1px solid var(--line)' }}>Minister passport</NavLink>
              </>
            )}
          </nav>
          {user ? (
            <button type="button" className="btn btn-outline btn-block" onClick={() => { logout(); onClose(); }}>Sign out</button>
          ) : (
            <div className="stack stack-3">
              <Link to="/login" className="btn btn-outline btn-block" onClick={onClose}>Sign in</Link>
              <Link to="/signup" className="btn btn-primary btn-block" onClick={onClose}>Create an account</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Header = () => {
  const { user, ready } = useAuth();
  const { count } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

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
            <span className="brand-mark" aria-hidden="true">K</span>
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
              <>
                <Link to="/dashboard" className="btn btn-ghost btn-sm hide-on-narrow">My learning</Link>
                <AccountMenu />
              </>
            ) : (
              <div className="row" style={{ gap: 8 }}>
                <Link to="/login" className="btn btn-ghost btn-sm hide-on-narrow">Sign in</Link>
                <Link to="/signup" className="btn btn-primary btn-sm hide-on-narrow">Create account</Link>
              </div>
            ))}

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
            <span className="brand-mark" aria-hidden="true">K</span>
            <span className="brand-name" style={{ color: '#fff' }}>Kingdom Network</span>
          </Link>
          <p className="small" style={{ maxWidth: '34ch', color: 'var(--ink-inverse-2)' }}>
            Church-issued courses, credentials and ordination pathways, and the platform churches use to teach and issue them.
          </p>
        </div>
        <div>
          <h5>Learn</h5>
          <ul>
            <li><Link to="/courses">All courses</Link></li>
            <li><Link to="/pathways">Credential pathways</Link></li>
            <li><Link to="/churches">Churches</Link></li>
            <li><Link to="/verify">Verify a credential</Link></li>
          </ul>
        </div>
        <div>
          <h5>Subjects</h5>
          <ul>
            <li><Link to="/courses?category=Pastoral+Ministry">Pastoral ministry</Link></li>
            <li><Link to="/courses?category=Biblical+Studies">Biblical studies</Link></li>
            <li><Link to="/courses?category=Preaching+%26+Teaching">Preaching</Link></li>
            <li><Link to="/courses?category=Counselling+%26+Care">Counselling and care</Link></li>
          </ul>
        </div>
        <div>
          <h5>Account</h5>
          <ul>
            <li><Link to="/signup">Create an account</Link></li>
            <li><Link to="/login">Sign in</Link></li>
            <li><Link to="/dashboard">My learning</Link></li>
            <li><Link to="/passport">Minister passport</Link></li>
          </ul>
        </div>
        <div>
          <h5>For churches</h5>
          <ul>
            <li><Link to="/teach">Teach on Kingdom Network</Link></li>
            <li><Link to="/churches">Partner directory</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Kingdom Network</span>
        <span>Nairobi · Kampala · Accra · Houston</span>
      </div>
    </div>
  </footer>
);

export const Layout = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="shell">
      <Header />
      <main><Outlet /></main>
      <Footer />
    </div>
  );
};
