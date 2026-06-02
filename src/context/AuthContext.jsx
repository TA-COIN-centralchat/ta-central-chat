import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { clearCurrentUser } from "../utils/authUtils";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [currentAgent, setCurrentAgent] = useState(null);

  useEffect(() => {
    let isMounted = true;

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
          if (isMounted) {
            clearCurrentUser();
            setIsAuthenticated(false);
            setCurrentUserRole(null);
            setCurrentAgent(null);
          }
          return;
        }

        const userEmail = session.user.email;

        const { data: agent, error: agentError } = await supabase
          .from("agents")
          .select("id, full_name, email, role, status")
          .eq("email", userEmail)
          .single();

        if (agentError || !agent) {
          console.error("Agent profile not found for logged-in user:", {
            userEmail,
            agentError,
          });

          if (isMounted) {
            clearCurrentUser();
            setIsAuthenticated(false);
            setCurrentUserRole(null);
            setCurrentAgent(null);
          }
          return;
        }

        // Keep localStorage in sync for now as services still rely on it for non-RLS query filtering
        localStorage.setItem("currentAgentId", agent.id);
        localStorage.setItem("currentUserName", agent.full_name);
        localStorage.setItem("currentUserEmail", agent.email);
        localStorage.setItem("currentUserRole", agent.role);

        if (isMounted) {
          setIsAuthenticated(true);
          setCurrentUserRole(agent.role);
          setCurrentAgent(agent);
        }
      } catch (error) {
        console.error("Auth check failed:", error);

        if (isMounted) {
          clearCurrentUser();
          setIsAuthenticated(false);
          setCurrentUserRole(null);
          setCurrentAgent(null);
        }
      } finally {
        if (isMounted) {
          setCheckingAuth(false);
        }
      }
    };

    checkAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event) => {
      if (_event === "SIGNED_OUT") {
        clearCurrentUser();
        setIsAuthenticated(false);
        setCurrentUserRole(null);
        setCurrentAgent(null);
      } else if (_event === "SIGNED_IN") {
        checkAccess();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        checkingAuth,
        isAuthenticated,
        currentUserRole,
        currentAgent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
