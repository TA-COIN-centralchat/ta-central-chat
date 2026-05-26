import { useEffect, useState } from "react";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { supabase } from "../services/supabaseClient";

/* ═══════════════════════════════════════════════════════════════════════════
   LoginPage — Enterprise Login
   ─────────────────────────────────────────────────────────────────────────
   Layout system:
     • 8 px base grid  → Tailwind: gap-2 = 8 px, gap-3 = 12 px, gap-4 = 16 px,
       gap-6 = 24 px, gap-8 = 32 px, gap-10 = 40 px
     • All interactive controls share h-12 (48 px) for a uniform touch target
     • Input wrappers use `flex items-center` so icon + text + toggle are
       vertically centred regardless of font metrics
     • The outer card uses CSS Grid (`lg:grid-cols-[1fr_480px]`) to keep the
       form panel a fixed 480 px on desktop while the branding panel flexes
     • Consistent `rounded-2xl` (16 px) on cards / panels, `rounded-xl` (12 px)
       on inputs / buttons for a clear visual hierarchy
   ═══════════════════════════════════════════════════════════════════════════ */

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath = location.state?.from || "/dashboard";

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  /* ── Session check ──────────────────────────────────────────────────── */

  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        setHasSession(Boolean(session?.user));
      } catch (error) {
        console.error("Failed to check existing session:", error);
      } finally {
        setCheckingSession(false);
      }
    };

    checkExistingSession();
  }, []);

  /* ── Handlers ───────────────────────────────────────────────────────── */

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errorMessage) setErrorMessage("");
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    const email = formData.email.trim();
    const password = formData.password;

    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    try {
      setLoggingIn(true);
      setErrorMessage("");

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (authError) throw authError;

      const userEmail = authData.user?.email;

      if (!userEmail) {
        throw new Error("Login succeeded, but no email was returned.");
      }

      const { data: agent, error: agentError } = await supabase
        .from("agents")
        .select("id, full_name, email, role, status")
        .eq("email", userEmail)
        .single();

      if (agentError || !agent) {
        await supabase.auth.signOut();

        throw new Error(
          "Login successful, but no agent profile was found for this email. Please create an agent account with the same email.",
        );
      }

      localStorage.setItem("currentAgentId", agent.id);
      localStorage.setItem("currentUserName", agent.full_name);
      localStorage.setItem("currentUserEmail", agent.email);
      localStorage.setItem("currentUserRole", agent.role);

      await supabase
        .from("agents")
        .update({ status: "Available" })
        .eq("id", agent.id);

      navigate(redirectPath, { replace: true });
    } catch (error) {
      console.error("Login failed:", error);
      setErrorMessage(error?.message || "Login failed. Please try again.");
    } finally {
      setLoggingIn(false);
    }
  };

  /* ── Loading state ──────────────────────────────────────────────────── */

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur-sm">
          <Loader2 size={28} className="animate-spin text-white" />
          <p className="text-sm text-slate-400">Verifying session…</p>
        </div>
      </div>
    );
  }

  /* ── Already authenticated ──────────────────────────────────────────── */

  if (hasSession) {
    return <Navigate to={redirectPath} replace />;
  }

  /* ── Main render ────────────────────────────────────────────────────── */

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      {/* Background glow accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-amber-400/15 blur-3xl"
      />

      {/* ── Card shell ──────────────────────────────────────────────── */}
      <div className="relative grid w-full max-w-[960px] overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl lg:grid-cols-[1fr_480px]">
        {/* ── Left: Branding panel (desktop only) ───────────────────── */}
        <section className="hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-10 text-white lg:flex">
          <div className="flex h-full w-full flex-col justify-between gap-10">
            {/* Brand header */}
            <div className="space-y-6">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-2xl font-bold text-slate-950">
                $
              </div>

              <h1 className="text-4xl font-bold leading-tight tracking-tight">
                T.A Coin
                <br />
                Central Chat
              </h1>

              <p className="max-w-sm text-sm leading-relaxed text-slate-400">
                Secure access for support agents to manage customer tickets,
                conversations, channels, and service workflows — all in one
                place.
              </p>
            </div>

            {/* Feature list */}
            <div className="space-y-3">
              <FeatureItem text="Role-based access control" />
              <FeatureItem text="Agent ticket management" />
              <FeatureItem text="Centralized Telegram & chatbot support" />
            </div>
          </div>
        </section>

        {/* ── Right: Login form ─────────────────────────────────────── */}
        <section className="flex flex-col justify-center px-8 py-10 sm:px-10">
          {/* Mobile-only brand mark */}
          <div className="mb-6 flex justify-center lg:hidden">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-2xl font-bold text-slate-950">
              $
            </div>
          </div>

          {/* Desktop-only shield icon */}
          <div className="mb-6 hidden lg:block">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <ShieldCheck size={24} />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-950">Welcome back</h2>
            <p className="text-sm text-slate-500">
              Sign in with your agent account to continue.
            </p>
          </div>

          {/* Error banner */}
          {errorMessage && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0 text-red-500"
              />
              <p className="text-sm leading-relaxed text-red-700">
                {errorMessage}
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="mt-8 space-y-6">
            {/* Email field */}
            <div className="space-y-2">
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-slate-700"
              >
                Email
              </label>

              <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 transition-shadow focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
                <Mail size={18} className="shrink-0 text-slate-400" />

                <input
                  id="login-email"
                  type="email"
                  value={formData.email}
                  onChange={(event) =>
                    handleChange("email", event.target.value)
                  }
                  placeholder="agent@tacoin.com"
                  autoComplete="email"
                  className="h-full w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-slate-700"
              >
                Password
              </label>

              <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 transition-shadow focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
                <Lock size={18} className="shrink-0 text-slate-400" />

                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(event) =>
                    handleChange("password", event.target.value)
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="h-full w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loggingIn}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingIn ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Info notice */}
          <div className="mt-8 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <p className="text-xs leading-relaxed text-slate-500">
              Your email must exist in both Supabase Auth and the{" "}
              <span className="font-semibold text-slate-700">agents</span>{" "}
              table to sign in successfully.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

const FeatureItem = ({ text }) => (
  <div className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-slate-300">
    <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
    {text}
  </div>
);

export default LoginPage;
