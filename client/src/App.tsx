import { lazy, Suspense } from 'react';
import { RouterProvider, createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from './app/layouts/MainLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { CircularProgress, Box } from '@mui/material';

const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })));
const AdminDocumentsPage = lazy(() =>
  import('./pages/admin/AdminDocumentsPage').then((module) => ({ default: module.AdminDocumentsPage })),
);
const AdminRulesPage = lazy(() => import('./pages/admin/AdminRulesPage').then((module) => ({ default: module.AdminRulesPage })));
const AdminAuditPage = lazy(() => import('./pages/admin/AdminAuditPage').then((module) => ({ default: module.AdminAuditPage })));
const AdminSystemLogsPage = lazy(() =>
  import('./pages/admin/AdminSystemLogsPage').then((module) => ({ default: module.AdminSystemLogsPage })),
);
const AdminBackupsPage = lazy(() =>
  import('./pages/admin/AdminBackupsPage').then((module) => ({ default: module.AdminBackupsPage })),
);
const DocumentsPage = lazy(() => import('./pages/documents/DocumentsPage').then((module) => ({ default: module.DocumentsPage })));
const ProfileSecurityPage = lazy(() =>
  import('./pages/profile/ProfileSecurityPage').then((module) => ({ default: module.ProfileSecurityPage })),
);
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage').then((module) => ({ default: module.RegisterPage })));
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage').then((module) => ({ default: module.VerifyEmailPage })));

const LoadingScreen = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <CircularProgress />
  </Box>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <MainLayout />
      </Suspense>
    ),
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          { index: true, element: <Navigate to="/documents" replace /> },
          {
            path: 'documents',
            element: (
              <Suspense fallback={<LoadingScreen />}>
                <DocumentsPage />
              </Suspense>
            ),
          },
          {
            path: 'profile/security',
            element: (
              <Suspense fallback={<LoadingScreen />}>
                <ProfileSecurityPage />
              </Suspense>
            ),
          },
        ],
      },
      {
        element: <ProtectedRoute requireAdmin={true} />,
        children: [
          {
            path: 'admin/users',
            element: (
              <Suspense fallback={<LoadingScreen />}>
                <AdminUsersPage />
              </Suspense>
            ),
          },
          {
            path: 'admin/documents',
            element: (
              <Suspense fallback={<LoadingScreen />}>
                <AdminDocumentsPage />
              </Suspense>
            ),
          },
          {
            path: 'admin/rules',
            element: (
              <Suspense fallback={<LoadingScreen />}>
                <AdminRulesPage />
              </Suspense>
            ),
          },
          {
            path: 'admin/audit',
            element: (
              <Suspense fallback={<LoadingScreen />}>
                <AdminAuditPage />
              </Suspense>
            ),
          },
          {
            path: 'admin/system-logs',
            element: (
              <Suspense fallback={<LoadingScreen />}>
                <AdminSystemLogsPage />
              </Suspense>
            ),
          },
          {
            path: 'admin/backups',
            element: (
              <Suspense fallback={<LoadingScreen />}>
                <AdminBackupsPage />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
  {
    path: '/login',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/register',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <RegisterPage />
      </Suspense>
    ),
  },
  {
    path: '/verify',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <VerifyEmailPage />
      </Suspense>
    ),
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
