import {
  Navigate,
  useLocation,
} from 'react-router-dom';

import {
  getCurrentUserRole,
} from '../utils/authUtils';

const routeAccess = {
  Admin: [
    '/dashboard',
    '/reports',
    '/audit-logs',
    '/tickets',
    '/waiting-queue',
    '/investigation',
    '/ready-to-contact',
    '/closed',
    '/manual-ticket',
    '/live-chat',
    '/telegram',
    '/facebook',
    '/customers',
    '/agents',
    '/categories',
    '/settings',
  ],

  'Customer Service Agent': [
    '/dashboard',
    '/tickets',
    '/investigation',
    '/ready-to-contact',
    '/closed',
    '/manual-ticket',
    '/live-chat',
    '/telegram',
    '/facebook',
    '/customers',
  ],

  'Customer Support Agent': [
    '/dashboard',
    '/tickets',
    '/investigation',
    '/ready-to-contact',
    '/closed',
    '/manual-ticket',
    '/live-chat',
    '/telegram',
    '/facebook',
    '/customers',
  ],
};

const ProtectedRoute = ({
  children,
}) => {
  const location = useLocation();

  const currentUserRole =
    getCurrentUserRole();

  if (!currentUserRole) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  const allowedRoutes =
    routeAccess[currentUserRole] ||
    [];

  const canAccess =
    allowedRoutes.some(
      (route) =>
        location.pathname ===
          route ||
        location.pathname.startsWith(
          `${route}/`,
        ),
    );

  if (!canAccess) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return children;
};

export default ProtectedRoute;