import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { supabase } from "../services/supabaseClient";

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

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

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
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError) {
        throw authError;
      }

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

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-center text-white shadow-xl backdrop-blur">
          <Loader2 size={30} className="mx-auto animate-spin" />
          <p className="mt-4 text-sm text-slate-300">Checking session...</p>
        </div>
      </div>
    );
  }

  if (hasSession) {
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="absolute left-[-10%] top-[-10%] h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-4xl border border-white/10 bg-white shadow-2xl lg:grid-cols-[1fr_440px]">
        <section className="hidden bg-linear-to-br from-slate-950 via-slate-900 to-blue-950 p-10 text-white lg:block">
          <div className="flex h-full flex-col justify-between">
            <div>
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-2xl font-bold text-slate-950">
                $
              </div>

              <h1 className="mt-8 text-4xl font-bold tracking-tight">
                T.A Coin Central Chat
              </h1>

              <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
                Secure access for support agents to manage customer tickets,
                conversations, channels, and service workflows in one place.
              </p>
            </div>

            <div className="grid gap-3">
              <FeatureItem text="Role-based access control" />
              <FeatureItem text="Agent ticket management" />
              <FeatureItem text="Centralized Telegram and chatbot support" />
            </div>
          </div>
        </section>

        <section className="p-8 sm:p-10">
          <div className="text-center lg:text-left">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-2xl font-bold text-slate-950 lg:mx-0 lg:hidden">
              $
            </div>

            <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 lg:flex">
              <ShieldCheck size={24} />
            </div>

            <h2 className="mt-5 text-2xl font-bold text-slate-950">
              Welcome back
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Sign in with your agent account to continue.
            </p>
          </div>

          {errorMessage && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Email
              </label>

              <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 h-10 px-3.5 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50">
                <Mail size={18} className="text-slate-400" />

                <input
                  type="email"
                  value={formData.email}
                  onChange={(event) =>
                    handleChange("email", event.target.value)
                  }
                  placeholder="agent@tacoin.com"
                  autoComplete="email"
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Password
              </label>

              <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 h-10 px-3.5 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50">
                <Lock size={18} className="text-slate-400" />

                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(event) =>
                    handleChange("password", event.target.value)
                  }
                  placeholder="Enter password"
                  autoComplete="current-password"
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingIn ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                "Login"
              )}
            </button>
          </form>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
            Your email must exist in both Supabase Auth and the
            <span className="font-semibold text-slate-700"> agents </span>
            table.
          </div>
        </section>
      </div>
    </div>
  );
};

const FeatureItem = ({ text }) => {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-200">
      <div className="h-2 w-2 rounded-full bg-emerald-400" />
      {text}
    </div>
  );
};

export default LoginPage;
