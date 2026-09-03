import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { Layout } from './components/Layout.jsx';
import { AdminShell, ChurchShell } from './components/admin/Shell.jsx';
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

import { Apply } from './pages/Apply.jsx';
import { ApplicationDetail, Applications } from './pages/Applications.jsx';
import { InterviewBooking } from './pages/InterviewBooking.jsx';
import { Give, GiveThanks } from './pages/Give.jsx';
import { ChurchRegister } from './pages/ChurchRegister.jsx';
import { AcceptInvite, ForgotPassword, ReferenceForm, ResetPassword } from './pages/Standalone.jsx';

import { Overview } from './pages/manage/Overview.jsx';
import { Applicants } from './pages/manage/Applicants.jsx';
import { CredentialEditor, Credentials } from './pages/manage/Credentials.jsx';
import { CourseEditor, Courses as ManageCourses } from './pages/manage/Courses.jsx';
import { AssessmentEditor, Assessments } from './pages/manage/Assessments.jsx';
import { Media } from './pages/manage/Media.jsx';
import { Interviews } from './pages/manage/Interviews.jsx';
import { PageBuilder } from './pages/manage/PageBuilder.jsx';
import { Donations } from './pages/manage/Donations.jsx';
import { Finance } from './pages/manage/Finance.jsx';
import { Team } from './pages/manage/Team.jsx';
import { Settings } from './pages/manage/Settings.jsx';
import { Issued } from './pages/manage/Issued.jsx';
import { Resources } from './pages/manage/Resources.jsx';

import {
  AdminApplications, AdminAudit, AdminChurches, AdminMerchandising, AdminOverview,
  AdminPayments, AdminSettings, AdminSettlements, AdminUsers, AdminVerification,
} from './pages/admin/AdminPages.jsx';

// Outcome pages sit at the root because they are the pages people land on.
const OUTCOMES = ['ordination', 'certification', 'ministry-license', 'church-affiliation', 'invitation-letter'];

const RequireAuth = ({ children }) => {
  const { user, memberships, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="wrap band"><Spinner /></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  if (user.accountKind === 'church') {
    const church = memberships[0];
    return church ? <Navigate to={`/manage/${church.churchSlug}`} replace /> : <Navigate to="/login" replace />;
  }
  return children;
};

export const App = () => (
  <Routes>
    {/* Full-screen, with their own chrome. */}
    <Route path="/learn/:slug" element={<RequireAuth><Learn /></RequireAuth>} />
    <Route path="/church/register" element={<ChurchRegister />} />

    {/* The church console. */}
    <Route path="/manage/:churchSlug" element={<ChurchShell />}>
      <Route index element={<Overview />} />
      <Route path="applicants" element={<Applicants />} />
      <Route path="credentials" element={<Credentials />} />
      <Route path="credentials/:slug" element={<CredentialEditor />} />
      <Route path="courses" element={<ManageCourses />} />
      <Route path="courses/:slug" element={<CourseEditor />} />
      <Route path="assessments" element={<Assessments />} />
      <Route path="assessments/:slug" element={<AssessmentEditor />} />
      <Route path="resources" element={<Resources />} />
      <Route path="media" element={<Media />} />
      <Route path="interviews" element={<Interviews />} />
      <Route path="issued" element={<Issued />} />
      <Route path="page" element={<PageBuilder />} />
      <Route path="donations" element={<Donations />} />
      <Route path="finance" element={<Finance />} />
      <Route path="team" element={<Team />} />
      <Route path="settings" element={<Settings />} />
    </Route>

    {/* The platform console. */}
    <Route path="/admin" element={<AdminShell />}>
      <Route index element={<AdminOverview />} />
      <Route path="churches" element={<AdminChurches />} />
      <Route path="verification" element={<AdminVerification />} />
      <Route path="users" element={<AdminUsers />} />
      <Route path="applications" element={<AdminApplications />} />
      <Route path="payments" element={<AdminPayments />} />
      <Route path="settlements" element={<AdminSettlements />} />
      <Route path="merchandising" element={<AdminMerchandising />} />
      <Route path="settings" element={<AdminSettings />} />
      <Route path="audit" element={<AdminAudit />} />
    </Route>

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
      <Route path="for-churches" element={<Teach />} />
      <Route path="login" element={<Login />} />
      <Route path="signup" element={<Signup />} />
      <Route path="forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password" element={<ResetPassword />} />
      <Route path="reference/:token" element={<ReferenceForm />} />

      {/* Giving to a church needs no account. */}
      <Route path="give/:slug" element={<Give />} />
      <Route path="give/:slug/thanks" element={<GiveThanks />} />

      {/* Onboarding a church. */}
      <Route path="onboarding" element={<Navigate to="/church/register" replace />} />
      <Route path="onboarding/:churchSlug/:step" element={<Navigate to="/church/register" replace />} />
      <Route path="invite/:token" element={<AcceptInvite />} />

      {/* Applying, and following what happens next. */}
      <Route path="apply/:slug" element={<Apply />} />
      <Route path="applications" element={<RequireAuth><Applications /></RequireAuth>} />
      <Route path="applications/:reference" element={<RequireAuth><ApplicationDetail /></RequireAuth>} />
      <Route path="applications/:reference/assessment" element={<RequireAuth><Assessment /></RequireAuth>} />
      <Route path="applications/:reference/interview" element={<RequireAuth><InterviewBooking /></RequireAuth>} />

      <Route path="orders" element={<RequireAuth><Orders /></RequireAuth>} />
      <Route path="orders/:reference" element={<RequireAuth><OrderConfirmation /></RequireAuth>} />
      <Route path="dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="passport" element={<RequireAuth><Passport /></RequireAuth>} />
      <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />

      {/* Paths from earlier shapes of the product. */}
      <Route path="pathways" element={<Navigate to="/ordination" replace />} />
      <Route path="teach" element={<Navigate to="/for-churches" replace />} />

      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);
