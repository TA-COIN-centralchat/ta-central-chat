import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';

import { supabase } from '../services/supabaseClient';
import { clearCurrentUser } from '../utils/authUtils';

const ProtectedRoute = ({ allowedRoles, children }) => {
  const location = useLocation();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        setCheckingAuth(true);

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session?.user) {
          clearCurrentUser();
          setIsAuthenticated(false);
          setCurrentUserRole(null);
          return;
        }

        const userEmail = session.user.email;

        const { data: agent, error: agentError } = await supabase
          .from('agents')
          .select('id, full_name, email, role, status')
          .eq('email', userEmail)
          .single();

        if (agentError || !agent) {
          console.error('Agent profile not found for logged-in user:', {
            userEmail,
            agentError,
          });

          clearCurrentUser();
          setIsAuthenticated(false);
          setCurrentUserRole(null);
          return;
        }

        localStorage.setItem('currentAgentId', agent.id);
        localStorage.setItem('currentUserName', agent.full_name);
        localStorage.setItem('currentUserEmail', agent.email);
        localStorage.setItem('currentUserRole', agent.role);

        setIsAuthenticated(true);
        setCurrentUserRole(agent.role);
      } catch (error) {
        console.error('Protected route auth check failed:', error);

        clearCurrentUser();
        setIsAuthenticated(false);
        setCurrentUserRole(null);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAccess();
  }, []);

  if (checkingAuth) {
    return <AuthLoading />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  const hasAccess = allowedRoles.includes(currentUserRole);

  if (!hasAccess) {
    return (
      <AccessDenied
        allowedRoles={allowedRoles}
        currentUserRole={currentUserRole}
      />
    );
  }

  return children;
};

const AuthLoading = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Loader2 size={28} className="animate-spin" />
        </div>

        <h1 className="mt-5 text-lg font-semibold text-slate-950">
          Checking access
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Please wait while we verify your session.
        </p>
      </div>
    </div>
  );
};

const AccessDenied = ({ allowedRoles, currentUserRole }) => {
  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <ShieldAlert size={28} />
        </div>

        <h1 className="mt-5 text-2xl font-semibold text-slate-950">
          Access Denied
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Your current role does not have permission to access this page.
        </p>

        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-left text-sm text-slate-600">
          <div>
            <span className="font-medium text-slate-900">Current role:</span>{' '}
            {currentUserRole || 'No role found'}
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