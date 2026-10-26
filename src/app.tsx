import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { Layout } from '@/components/Layout';
import DashboardPage from '@/pages/DashboardPage';
import { CommunityInfoPage, CompanyInfoPage } from '@/pages/DataPages';
import StaffPage from '@/pages/StaffPage';
import OwnersPage from '@/pages/OwnersPage';
import {
  ArrearsPage,
  LedgerAnalysisPage,
  LedgerSummaryPage,
  PaymentRecordsPage,
} from '@/pages/LedgerPages';
import LoginLogsPage from '@/pages/LoginLogsPage';
import PrintPage from '@/pages/PrintPage/PrintPage';
import SettingsPage from '@/pages/SettingsPage/SettingsPage';
import NotFoundPage from '@/pages/NotFoundPage/NotFoundPage';
import LoginPage from '@/pages/LoginPage';
import AccountPage from '@/pages/AccountPage';
import { isAuthed } from '@/lib/auth';
import { useCurrentUser } from '@/lib/use-current-user';
import { canAccess, isAdmin, landingPath, type PermissionKey } from '@/lib/permissions';
import { useDraggableDialog } from '@/lib/draggable-dialog';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  if (!isAuthed() || !user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PermissionRoute({ permission, children }: { permission: PermissionKey; children: React.ReactNode }) {
  const user = useCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccess(user, permission)) return <Navigate to={landingPath(user)} replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin(user)) return <Navigate to={landingPath(user)} replace />;
  return <>{children}</>;
}

export default function App() {
  useDraggableDialog();
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<PermissionRoute permission="dashboard"><DashboardPage /></PermissionRoute>} />
          <Route path="data/community" element={<PermissionRoute permission="community"><CommunityInfoPage /></PermissionRoute>} />
          <Route path="data/company" element={<PermissionRoute permission="company"><CompanyInfoPage /></PermissionRoute>} />
          <Route path="data/staff" element={<AdminRoute><StaffPage /></AdminRoute>} />
          <Route path="assets/owners" element={<PermissionRoute permission="owners"><OwnersPage /></PermissionRoute>} />
          <Route path="ledger" element={<Navigate to="/ledger/summary" replace />} />
          <Route path="ledger/analysis" element={<PermissionRoute permission="analysis"><LedgerAnalysisPage /></PermissionRoute>} />
          <Route path="ledger/summary" element={<PermissionRoute permission="summary"><LedgerSummaryPage /></PermissionRoute>} />
          <Route path="ledger/payments" element={<PermissionRoute permission="payments"><PaymentRecordsPage /></PermissionRoute>} />
          <Route path="ledger/arrears" element={<PermissionRoute permission="arrears"><ArrearsPage /></PermissionRoute>} />
          <Route path="login-logs" element={<AdminRoute><LoginLogsPage /></AdminRoute>} />
          <Route path="print" element={<PermissionRoute permission="print"><PrintPage /></PermissionRoute>} />
          <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Toaster position="top-center" richColors />
    </>
  );
}
