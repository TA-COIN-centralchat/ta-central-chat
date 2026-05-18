import { ShieldAlert } from 'lucide-react';

export const currentUserRole = 'Admin';

// Later this role should come from Supabase Auth / logged-in agent profile.
// Test roles:
// export const currentUserRole = 'Customer Service Agent';
// export const currentUserRole = 'Customer Support Agent';

const ProtectedRoute = ({ allowedRoles, children }) => {
  const hasAccess = allowedRoles.includes(currentUserRole);

  if (!hasAccess) {
    return <AccessDenied allowedRoles={allowedRoles} />;
  }

  return children;
};

const AccessDenied = ({ allowedRoles }) => {
  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <ShieldAlert size={28} />
        </div>

        <h1 className="mt-5 text-2xl font-semibold text-slate-950">
          Access Denied
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Your current role does not have permission to access this page.
        </p>

        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-left text-sm text-slate-600">
          <div>
            <span className="font-medium text-slate-900">Current role:</span>{' '}
            {currentUserRole}
          </div>

          <div className="mt-2">
            <span className="font-medium text-slate-900">Allowed roles:</span>{' '}
            {allowedRoles.join(', ')}
          </div>
        </div>

        <a
          href="/dashboard"
          className="mt-6 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  );
};

export default ProtectedRoute;