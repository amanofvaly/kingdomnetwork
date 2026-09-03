import { Navigate, useLocation } from 'react-router-dom';

import { Spinner } from '../components/ui.jsx';
import { useAuth } from './auth.jsx';

/**
 * One gate, three answers: wait, send them to sign in, or send them where
 * their account actually belongs.
 *
 * An account is personal or church and never both, so "signed in" is not
 * enough to let someone through — a church account arriving at a personal
 * route is not an error to report, it is a wrong turn to correct quietly.
 */
export const Gate = ({ kind = 'personal', children }) => {
  const { user, memberships, ready, isPlatformAdmin } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="me-boot" aria-label="Loading">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  if (kind === 'personal' && user.accountKind === 'church') {
    const church = memberships[0];
    return <Navigate to={church ? `/manage/${church.churchSlug}` : '/login'} replace />;
  }

  if (kind === 'church' && user.accountKind !== 'church' && !isPlatformAdmin) {
    return <Navigate to="/me" replace />;
  }

  return children;
};
