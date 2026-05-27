import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import logo from '../assets/logo.png';

import { supabase } from '../services/supabaseClient';
import {
  markAgentOnline,
  startAgentHeartbeat,
} from '../services/agentPresenceService';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath = location.state?.from || '/dashboard';

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        setHasSession(Boolean(session?.user));
      } catch (error) {
        console.error('Failed to check existing session:', error);
      } finally {
        setCheckingSession(false);
      }
    };

    checkExistingSession();
  }, []);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errorMessage) setErrorMessage('');
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    const email = formData.email.trim();
    const password = formData.password;

    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    try {
      setLoggingIn(true);
      setErrorMessage('');

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError) {
        throw authError;
      }

      const userEmail = authData.user?.email;

      if (!userEmail) {
        throw new Error('Login succeeded, but no email was returned.');
      }

      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id, full_name, email, role, status')
        .eq('email', userEmail)
        .single();

      if (agentError || !agent) {
        await supabase.auth.signOut();

        throw new Error(
          'Login successful, but no agent profile was found for this email. Please create an agent account with the same email.'
        );
      }

      localStorage.setItem('currentAgentId', agent.id);
      localStorage.setItem('currentUserName', agent.full_name);
      localStorage.setItem('currentUserEmail', agent.email);
      localStorage.setItem('currentUserRole', agent.role);

      await supabase
        .from('agents')
        .update({ status: 'Available' })
        .eq('id', agent.id);

      await markAgentOnline({
        agentId: agent.id,
        fullName: agent.full_name,
        email: agent.email,
        role: agent.role,
      });

      startAgentHeartbeat(agent.id);

      navigate(redirectPath, { replace: true });
    } catch (error) {
      console.error('Login failed:', error);
      setErrorMessage(error?.message || 'Login failed. Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="system-page flex items-center justify-center px-4">
        <div className="system-card px-8 py-7 text-center">
          <Loader2 size={28} className="mx-auto animate-spin text-[#43acd6]" />

          <p className="mt-4 text-sm font-medium text-[#1d1d1f]">
            Checking session...
          </p>
        </div>
      </div>
    );
  }

  if (hasSession) {
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <div className="system-page flex min-h-screen items-center justify-center px-4 py-10">
      <div className="system-shell grid w-full max-w-5xl lg:grid-cols-[1fr_0.92fr]">
        {/* LEFT BRAND PANEL */}
        <section className="system-brand-panel hidden min-h-152.5 px-12 py-12 lg:flex">
          <div className="flex w-full flex-col items-center justify-center text-center">
            <img
              src={logo}
              alt="T.A Coin Logo"
              className="h-36 w-36 object-contain"
            />

            <h1 className="mt-7 text-[48px] font-semibold leading-[1.05] tracking-[-0.04em] text-[#1d1d1f]">
              T.A COIN
              <br />
              Central Dashboard
            </h1>

            <p className="mt-7 max-w-md text-[15px] font-normal leading-7 text-[#6e6e73]">
              Manage conversations, tickets, agents, and real-time service
              operations in one calm, clean dashboard.
            </p>

            <div className="mt-10 h-1 w-14 rounded-full bg-[#ffd21f]" />
          </div>
        </section>

        {/* RIGHT LOGIN PANEL */}
        <section className="flex min-h-152.5 items-center justify-center bg-white px-6 py-10 sm:px-10">
          <div className="w-full max-w-sm">
            <div className="mb-10 text-center lg:hidden">
              <img
                src={logo}
                alt="T.A Coin Logo"
                className="mx-auto h-28 w-28 object-contain"
              />

              <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                T.A Coin Central Dashboard
              </h1>

              <p className="mt-2 text-sm font-normal text-[#6e6e73]">
                Internal support dashboard
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#43acd6]">
                Admin & Agent
              </p>

              <h2 className="mt-3 text-[39px] font-semibold leading-none tracking-[-0.04em] text-[#1d1d1f]">
                Welcome back
              </h2>

              <p className="mt-4 text-sm font-normal leading-6 text-[#6e6e73]">
                Sign in with your registered admin or agent account.
              </p>
            </div>

            {errorMessage && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <div>
                <label className="text-sm font-medium text-[#1d1d1f]">
                  Email
                </label>

                <div className="system-input mt-2 flex items-center gap-3 rounded-2xl px-4 py-3">
                  <Mail size={18} className="shrink-0 text-[#8e8e93]" />

                  <input
                    type="email"
                    value={formData.email}
                    onChange={(event) =>
                      handleChange('email', event.target.value)
                    }
                    placeholder="agent@tacoin.com"
                    autoComplete="email"
                    className="w-full bg-transparent text-sm font-normal text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#1d1d1f]">
                  Password
                </label>

                <div className="system-input mt-2 flex items-center gap-3 rounded-2xl px-4 py-3">
                  <Lock size={18} className="shrink-0 text-[#8e8e93]" />

                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(event) =>
                      handleChange('password', event.target.value)
                    }
                    placeholder="Enter password"
                    autoComplete="current-password"
                    className="w-full bg-transparent text-sm font-normal text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="rounded-xl p-1.5 text-[#8e8e93] transition hover:bg-slate-100 hover:text-[#1d1d1f]"
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="system-button inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold"
              >
                {loggingIn ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs font-normal leading-5 text-[#6e6e73]">
              Only registered admins and agents can access this internal
              dashboard.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;