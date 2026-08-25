import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { Layout } from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import { useAuth } from './lib/auth.jsx';

import { Home } from './pages/Home.jsx';
import { Outcome } from './pages/Outcome.jsx';
import { Listing } from './pages/Listing.jsx';
import { Search } from './pages/Search.jsx';
import { Courses } from './pages/Courses.jsx';
import { CourseDetail } from './pages/CourseDetail.jsx';
import { Churches } from './pages/Churches.jsx';
import { ChurchDetail } from './pages/ChurchDetail.jsx';
import { Cart } from './pages/Cart.jsx';
import { Checkout } from './pages/Checkout.jsx';
import { OrderConfirmation } from './pages/OrderConfirmation.jsx';
import { Orders } from './pages/Orders.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Learn } from './pages/Learn.jsx';
import { Passport } from './pages/Passport.jsx';
import { Assessment } from './pages/Assessment.jsx';
import { Verify } from './pages/Verify.jsx';
import { Account } from './pages/Account.jsx';
import { Teach } from './pages/Teach.jsx';
import { Login, Signup } from './pages/Auth.jsx';
import { NotFound } from './pages/NotFound.jsx';

// Outcome pages sit at the root because they are the pages people land on.
const OUTCOMES = ['ordination', 'certification', 'ministry-license', 'church-affiliation', 'invitation-letter'];

const RequireAuth = ({ children }) => {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="wrap band"><Spinner /></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  return children;
};

export const App = () => (
  <Routes>
    <Route path="/learn/:slug" element={<RequireAuth><Learn /></RequireAuth>} />

    <Route element={<Layout />}>
      <Route index element={<Home />} />

      {/* Static paths, so the slug is passed in rather than read from params. */}
      {OUTCOMES.map((slug) => (
        <Route key={slug} path={slug} element={<Outcome slug={slug} />} />
      ))}

      <Route path="listing/:slug" element={<Listing />} />
      <Route path="search" element={<Search />} />
      <Route path="courses" element={<Courses />} />
      <Route path="courses/:slug" element={<CourseDetail />} />
      <Route path="churches" element={<Churches />} />
      <Route path="churches/:slug" element={<ChurchDetail />} />
      <Route path="cart" element={<Cart />} />
      <Route path="checkout" element={<Checkout />} />
      <Route path="verify" element={<Verify />} />
      <Route path="verify/:code" element={<Verify />} />
      <Route path="teach" element={<Teach />} />
      <Route path="login" element={<Login />} />
      <Route path="signup" element={<Signup />} />

      <Route path="orders" element={<RequireAuth><Orders /></RequireAuth>} />
      <Route path="orders/:reference" element={<RequireAuth><OrderConfirmation /></RequireAuth>} />
      <Route path="dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="passport" element={<RequireAuth><Passport /></RequireAuth>} />
      <Route path="assessment/:id" element={<RequireAuth><Assessment /></RequireAuth>} />
      <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />

      {/* Old paths from the course-first build. */}
      <Route path="pathways" element={<Navigate to="/ordination" replace />} />

      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);
