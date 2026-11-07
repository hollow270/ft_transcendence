import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth';
import { AppShell, FeaturePending } from './components';
import ArtifactPage from './pages/ArtifactPage';
import HomePage from './pages/HomePage';
import LlmPage from './pages/LlmPage';
import NotificationsPage from './pages/NotificationsPage';
import SecurityPage from './pages/SecurityPage';
import UserCommunityPage from './pages/UserCommunityPage';
import {
  AdminPage,
  ApiKeysPage,
  HistoryPage,
  ModerationPage,
  SearchPage,
  UrlPage,
} from './pages/PlaceholderPages';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="url" element={<UrlPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="artifact/:artifactId" element={<ArtifactPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="users/:userId/community" element={<UserCommunityPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile/security" element={<SecurityPage />} />
            <Route path="llm" element={<LlmPage />} />
            <Route path="api-keys" element={<ApiKeysPage />} />
            <Route path="moderation" element={<ModerationPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route
              path="*"
              element={
                <FeaturePending
                  title="Page not found"
                  description="The requested GO VIRUS route does not exist."
                />
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
