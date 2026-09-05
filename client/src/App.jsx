import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';

import { Layout } from './components/Layout.jsx';
import { AdminShell, ChurchShell } from './components/admin/Shell.jsx';
import { Spinner } from './components/ui.jsx';
import { useAuth } from './lib/auth.jsx';
import { useScrollTop } from './lib/useScrollTop.js';

import { Home } from './pages/Home.jsx';
import { Outcome } from './pages/Outcome.jsx';
import { Listing } from './pages/Listing.jsx';
import { Search } from './pages/Search.jsx';
import { Learning } from './pages/Learning.jsx';
import { Material } from './pages/Material.jsx';
import { CourseDetail } from './pages/CourseDetail.jsx';
import { Churches } from './pages/Churches.jsx';
import { ChurchDetail } from './pages/ChurchDetail.jsx';
import { Cart } from './pages/Cart.jsx';
import { Checkout } from './pages/Checkout.jsx';
import { OrderConfirmation } from './pages/OrderConfirmation.jsx';
import { Learn } from './pages/Learn.jsx';
import { Assessment } from './pages/Assessment.jsx';
import { Verify } from './pages/Verify.jsx';
import { Teach } from './pages/Teach.jsx';
import { Login, Signup } from './pages/Auth.jsx';
import { NotFound } from './pages/NotFound.jsx';

import { Apply } from './pages/Apply.jsx';
import { ApplicationDetail } from './pages/Applications.jsx';
import { InterviewBooking } from './pages/InterviewBooking.jsx';
import { Give, GiveThanks } from './pages/Give.jsx';
import { ChurchRegister } from './pages/ChurchRegister.jsx';
import { AcceptInvite, ForgotPassword, ReferenceForm, ResetPassword } from './pages/Standalone.jsx';

import { MeShell } from './components/me/Shell.jsx';
import { MeHome } from './pages/me/Home.jsx';
import { MeJourney } from './pages/me/Journey.jsx';
import { MePassport } from './pages/me/Passport.jsx';
import { MeLearning } from './pages/me/Learning.jsx';
import { MeLibrary } from './pages/me/Library.jsx';
import { MeGiving } from './pages/me/Giving.jsx';
import { MeInbox } from './pages/me/Inbox.jsx';
import { MeProfile } from './pages/me/Profile.jsx';
import { MeSettings } from './pages/me/Settings.jsx';

import { Overview } from './pages/manage/Overview.jsx';
import { Applicants } from './pages/manage/Applicants.jsx';
import { CredentialEditor, Credentials } from './pages/manage/Credentials.jsx';
import { CourseEditor, Courses as ManageCourses } from './pages/manage/Courses.jsx';
import { AssessmentEditor, Assessments } from './pages/manage/Assessments.jsx';
import { Media } from './pages/manage/Media.jsx';
import { Interviews } from './pages/manage/Interviews.jsx';
import { PageBuilder } from './pages/manage/PageBuilder.jsx';
import { Posts } from './pages/manage/Posts.jsx';
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

/** Keeps the query string, so an old /courses?q=… link still lands on its results. */
const RedirectWithQuery = ({ to }) => {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
};

/** The API calls them resources; people do not. */
const RedirectResource = () => {
  const { slug } = useParams();
  return <Navigate to={`/materials/${slug}`} replace />;
};

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

export const App = () => {
  // Above <Routes>, so it also covers the shells mounted outside <Layout>.
  useScrollTop();

  return (
    <Routes>
      {/* Full-screen, with their own chrome. */}
      <Route path="/learn/:slug" element={<RequireAuth><Learn /></RequireAuth>} />
      <Route path="/church/register" element={<ChurchRegister />} />

      {/* Giving needs no account — and no site chrome either. Nav and footer are
          exits standing beside a payment, so the page carries its own mark and
          nothing else to click. */}
      <Route path="/give/:slug" element={<Give />} />
      <Route path="/give/:slug/thanks" element={<GiveThanks />} />

      {/* The user's own area. Its own chrome, like the consoles — but it is not
          one: a console exists to make an administrator careful, this exists to
          give a person somewhere of their own. */}
      <Route path="/me" element={<MeShell />}>
        <Route index element={<MeHome />} />
        <Route path="journey" element={<MeJourney />} />
        <Route path="passport" element={<MePassport />} />
        <Route path="learning" element={<MeLearning />} />
        <Route path="library" element={<MeLibrary />} />
        <Route path="giving" element={<MeGiving />} />
        <Route path="inbox" element={<MeInbox />} />
        <Route path="profile" element={<MeProfile />} />
        <Route path="settings" element={<MeSettings />} />
      </Route>

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
        <Route path="posts" element={<Posts />} />
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

        <Route path="credentials" element={<Outcome slug="all" />} />
        <Route path="listing/:slug" element={<Listing />} />
        <Route path="search" element={<Search />} />
        <Route path="learning" element={<Learning />} />
        <Route path="courses/:slug" element={<CourseDetail />} />
        <Route path="materials/:slug" element={<Material />} />
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

        {/* Onboarding a church. */}
        <Route path="onboarding" element={<Navigate to="/church/register" replace />} />
        <Route path="onboarding/:churchSlug/:step" element={<Navigate to="/church/register" replace />} />
        <Route path="invite/:token" element={<AcceptInvite />} />

        {/* Applying, and following what happens next. */}
        <Route path="apply/:slug" element={<Apply />} />
        <Route path="applications/:reference" element={<RequireAuth><ApplicationDetail /></RequireAuth>} />
        <Route path="applications/:reference/assessment" element={<RequireAuth><Assessment /></RequireAuth>} />
        <Route path="applications/:reference/interview" element={<RequireAuth><InterviewBooking /></RequireAuth>} />

        <Route path="orders/:reference" element={<RequireAuth><OrderConfirmation /></RequireAuth>} />

        {/* Paths from earlier shapes of the product. The five personal pages
            that used to live out here are now sections of /me. */}
        <Route path="dashboard" element={<Navigate to="/me" replace />} />
        <Route path="account" element={<Navigate to="/me/profile" replace />} />
        <Route path="passport" element={<Navigate to="/me/passport" replace />} />
        <Route path="orders" element={<Navigate to="/me/library" replace />} />
        <Route path="applications" element={<Navigate to="/me/journey" replace />} />
        <Route path="courses" element={<RedirectWithQuery to="/learning" />} />
        <Route path="resources/:slug" element={<RedirectResource />} />
        <Route path="pathways" element={<Navigate to="/ordination" replace />} />
        <Route path="teach" element={<Navigate to="/for-churches" replace />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};
