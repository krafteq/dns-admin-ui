import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { AppShell } from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ZonesPage from './pages/ZonesPage';
import ZoneDetailPage from './pages/ZoneDetailPage';
import RecursorPage from './pages/RecursorPage';
import CachePage from './pages/CachePage';
import ForwardersPage from './pages/ForwardersPage';
import AuditLogPage from './pages/AuditLogPage';
import UsersPage from './pages/UsersPage';
import TsigKeysPage from './pages/TsigKeysPage';
import AutoprimariesPage from './pages/AutoprimariesPage';
import SearchPage from './pages/SearchPage';
import RecursorConfigPage from './pages/RecursorConfigPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/zones" element={<ZonesPage />} />
                <Route path="/zones/:zoneId" element={<ZoneDetailPage />} />
                <Route path="/recursor" element={<RecursorPage />} />
                <Route path="/cache" element={<CachePage />} />
                <Route path="/forwarders" element={<ForwardersPage />} />
                <Route path="/audit" element={<AuditLogPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/tsigkeys" element={<TsigKeysPage />} />
                <Route path="/autoprimaries" element={<AutoprimariesPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/recursor/config" element={<RecursorConfigPage />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
