import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { Layout } from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import { useAuth } from './lib/auth.jsx';

import { Home } from './pages/Home.jsx';
import { Courses } from './pages/Courses.jsx';
import { CourseDetail } from './pages/CourseDetail.jsx';
import { Pathways } from './pages/Pathways.jsx';
import { PathwayDetail } from './pages/PathwayDetail.jsx';
import { Churches } from './pages/Churches.jsx';
import { ChurchDetail } from './pages/ChurchDetail.jsx';
import { Cart } from './pages/Cart.jsx';
import { Checkout } from './pages/Checkout.jsx';
import { OrderConfirmation } from './pages/OrderConfirmation.jsx';
import { Orders } from './pages/Orders.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Learn } from './pages/Learn.jsx';
import { Passport } from './pages/Passport.jsx';
import { Verify } from './pages/Verify.jsx';
import { Account } from './pages/Account.jsx';
import { Teach } from './pages/Teach.jsx';
import { Login, Signup } from './pages/Auth.jsx';
import { NotFound } from './pages/NotFound.jsx';

const RequireAuth = ({ children }) => {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="wrap band"><Spinner /></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  return children;
};

export const App = () => (
  <Routes>
    {/* The course player runs outside the marketing shell. */}
    <Route path="/learn/:slug" element={<RequireAuth><Learn /></RequireAuth>} />

    <Route element={<Layout />}>
      <Route index element={<Home />} />
      <Route path="courses" element={<Courses />} />
      <Route path="courses/:slug" element={<CourseDetail />} />
      <Route path="pathways" element={<Pathways />} />
      <Route path="pathways/:slug" element={<PathwayDetail />} />
      <Route path="churches" element={<Churches />} />
      <Route path="churches/:slug" element={<ChurchDetail />} />
      <Route path="cart" element={<Cart />} />
      <Route path="verify" element={<Verify />} />
      <Route path="verify/:code" element={<Verify />} />
      <Route path="teach" element={<Teach />} />
      <Route path="login" element={<Login />} />
      <Route path="signup" element={<Signup />} />

      <Route path="checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
      <Route path="orders" element={<RequireAuth><Orders /></RequireAuth>} />
      <Route path="orders/:reference" element={<RequireAuth><OrderConfirmation /></RequireAuth>} />
      <Route path="dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="passport" element={<RequireAuth><Passport /></RequireAuth>} />
      <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />

      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);
