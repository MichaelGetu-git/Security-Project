import { Navigate, Outlet } from 'react-router-dom';
import { authStore } from '../store/authStore';
import { Box, Typography } from '@mui/material';

type ProtectedRouteProps = {
  requireAdmin?: boolean;
  requireRoles?: string[];
  requireAnyRole?: boolean; // If true, user needs ANY of the roles. If false, needs ALL roles.
};

export const ProtectedRoute = ({ requireAdmin = false, requireRoles = [], requireAnyRole = true }: ProtectedRouteProps) => {
  const { user, accessToken } = authStore();

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !user.roles?.includes('Admin')) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
        <Typography variant="h5" color="error">
          Access Denied
        </Typography>
        <Typography variant="body1" color="text.secondary">
          This page requires administrator privileges.
        </Typography>
      </Box>
    );
  }

  if (requireRoles.length > 0) {
    const userRoles = user.roles || [];
    const hasRequiredRoles = requireAnyRole
      ? requireRoles.some((role) => userRoles.includes(role))
      : requireRoles.every((role) => userRoles.includes(role));

    if (!hasRequiredRoles) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
          <Typography variant="h5" color="error">
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You don't have the required role(s): {requireRoles.join(', ')}
          </Typography>
        </Box>
      );
    }
  }

  return <Outlet />;
};

