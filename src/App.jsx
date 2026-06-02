import AppRoutes from "./routes/AppRoutes";
import { NotificationProvider } from "./context/NotificationContext";
import { AuthProvider } from "./context/AuthContext";
import { LayoutProvider } from "./context/LayoutContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

// Strip any persisted dark-mode class / preference left over from the
// removed ThemeProvider so the app always renders in light mode.
if (typeof document !== "undefined") {
  document.documentElement.classList.remove("dark");
}
if (typeof localStorage !== "undefined") {
  localStorage.removeItem("theme");
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LayoutProvider>
          <NotificationProvider>
            <AppRoutes />
          </NotificationProvider>
        </LayoutProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
