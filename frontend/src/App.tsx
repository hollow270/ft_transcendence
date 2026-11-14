import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AuthProvider } from './auth';
import { AppShell, FeaturePending, RequireAuth, RequireRole } from './components';
import AdminPage from './pages/AdminPage';
import AdminUsersPage from './pages/AdminUsersPage';
import ApiKeysPage from './pages/ApiKeysPage';
import ArtifactPage from './pages/ArtifactPage';
import AuthPage from './pages/AuthPage';
import HistoryPage from './pages/HistoryPage';
import LandingPage from './pages/LandingPage';
import LlmPage from './pages/LlmPage';
import ModerationPage from './pages/ModerationPage';
import NotificationsPage from './pages/NotificationsPage';
import OverviewPage from './pages/OverviewPage';
import ScanPage from './pages/ScanPage';
import SearchPage from './pages/SearchPage';
import SecurityPage from './pages/SecurityPage';
import SettingsPage from './pages/SettingsPage';
import UrlPage from './pages/UrlPage';
import UserCommunityPage from './pages/UserCommunityPage';

/** Keeps old links (/artifact/:id, /history, ...) working by moving them under /app. */
function LegacyRedirect() {
  const location = useLocation();
  const params = useParams();
  const rest = params['*'] ?? '';
  const base = location.pathname.split('/')[1];
  return <Navigate to={'/app/' + base + (rest ? '/' + rest : '') + location.search} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<AuthPage mode="login" />} />
          <Route path="signup" element={<AuthPage mode="signup" />} />

          <Route
            path="app"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<OverviewPage />} />
            <Route path="scan" element={<ScanPage />} />
            <Route path="url" element={<UrlPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="artifact/:artifactId" element={<ArtifactPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="users/:userId/community" element={<UserCommunityPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/security" element={<SecurityPage />} />
            <Route path="llm" element={<LlmPage />} />
            <Route path="api-keys" element={<ApiKeysPage />} />
            <Route
              path="moderation"
              element={
                <RequireRole roles={['MODERATOR', 'ADMIN']}>
                  <ModerationPage />
                </RequireRole>
              }
            />
            <Route
              path="admin"
              element={
                <RequireRole roles={['ADMIN']}>
                  <AdminPage />
                </RequireRole>
              }
            />
            <Route
              path="admin/users"
              element={
                <RequireRole roles={['ADMIN']}>
                  <AdminUsersPage />
                </RequireRole>
              }
            />
            <Route
              path="*"
              element={<FeaturePending title="Page not found" description="This address doesn't match any page in GO VIRUS." />}
            />
          </Route>

          {['artifact', 'url', 'search', 'history', 'users', 'notifications', 'llm', 'api-keys', 'moderation', 'admin'].map(
            (base) => (
              <Route key={base} path={base + '/*'} element={<LegacyRedirect />} />
            ),
          )}
          <Route path="profile/security" element={<Navigate to="/app/settings/security" replace />} />
          <Route path="register" element={<Navigate to="/signup" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
