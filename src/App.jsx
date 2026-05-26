import AppRoutes from "./routes/AppRoutes";
import { NotificationProvider } from "./context/NotificationContext";
import { AuthProvider } from "./context/AuthContext";
import { LayoutProvider } from "./context/LayoutContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

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
