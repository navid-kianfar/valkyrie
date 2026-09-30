import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/providers/auth';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { WelcomePage } from '@/pages/welcome';
import { SourceWizardPage } from '@/pages/source-wizard';
import { SourceDetailPage } from '@/pages/source-detail';
import { KeysPage } from '@/pages/keys';
import { CliPage } from '@/pages/cli';
import { BulkPage } from '@/pages/bulk';
import { ActivityPage } from '@/pages/activity';
import { SettingsPage } from '@/pages/settings';
import { Spinner } from '@/components/kit-extra';

export function App() {
  const { ready, user } = useAuth();
  if (!ready) return <div className="grid min-h-screen place-items-center"><Spinner className="size-8" /></div>;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      {!user ? <Route path="*" element={<Navigate to="/login" replace />} /> : (
        <>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/sources/new" element={<SourceWizardPage />} />
            <Route path="/sources/:id/edit" element={<SourceWizardPage />} />
            <Route path="/sources/:id" element={<SourceDetailPage />} />
            <Route path="/sources/:id/keys" element={<KeysPage />} />
            <Route path="/sources/:id/cli" element={<CliPage />} />
            <Route path="/keys" element={<KeysPage />} />
            <Route path="/cli" element={<CliPage />} />
            <Route path="/bulk" element={<BulkPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
  );
}
