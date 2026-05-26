import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import DashboardLayout from "../components/layout/DashboardLayout";
import DashboardPage from "../pages/DashboardPage";
import AllTicketsPage from "../pages/AllTicketsPage";
import LoginPage from "../pages/LoginPage";
import ManualTicketPage from "../pages/ManualTicketPage";
import AgentsPage from "../pages/AgentsPage";
import SettingsPage from "../pages/SettingsPage";
import WaitingQueuePage from "../pages/WaitingQueuePage";
import InvestigationPage from "../pages/InvestigationPage";
import ReadyToContactPage from "../pages/ReadyToContactPage";
import ClosedTicketsPage from "../pages/ClosedTicketsPage";
import CategoriesPage from "../pages/CategoriesPage";
import ReportsPage from "../pages/ReportsPage";
import ChannelTicketsPage from "../pages/ChannelTicketsPage";
import AuditLogsPage from "../pages/AuditLogsPage";
import CustomersPage from "../pages/CustomersPage";
import TicketDetailPage from "../pages/TicketDetailPage";
import SessionWorkspacePage from "../pages/SessionWorkspacePage";
import LiveChatPage from "../pages/LiveChatPage";

import ProtectedRoute from "./ProtectedRoute";

const ADMIN = ["Admin"];

const ALL_ROLES = ["Admin", "Customer Service Agent", "Customer Support Agent"];

const ADMIN_AND_SERVICE = ["Admin", "Customer Service Agent"];

const ADMIN_AND_SUPPORT = ["Admin", "Customer Support Agent"];

const protect = (roles, element) => (
  <ProtectedRoute allowedRoles={roles}>{element}</ProtectedRoute>
);

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route element={protect(ALL_ROLES, <DashboardLayout />)}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tickets" element={<AllTicketsPage />} />
          <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
          <Route path="/waiting-queue" element={<WaitingQueuePage />} />
          <Route path="/investigation" element={<InvestigationPage />} />
          <Route path="/ready-to-contact" element={<ReadyToContactPage />} />
          <Route path="/closed" element={<ClosedTicketsPage />} />
          <Route path="/manual-ticket" element={<ManualTicketPage />} />
          <Route path="/customers" element={<CustomersPage />} />
        </Route>

        <Route element={protect(ADMIN_AND_SERVICE, <DashboardLayout />)}>
          <Route path="/live-chat" element={<LiveChatPage />} />
          <Route path="/chatbot" element={<ChannelTicketsPage channel="Chatbot" />} />
          <Route path="/telegram" element={<ChannelTicketsPage channel="Telegram" />} />
          <Route path="/chatbot/:sessionId" element={<SessionWorkspacePage />} />
          <Route path="/telegram/:sessionId" element={<SessionWorkspacePage />} />
        </Route>

        <Route element={protect(ADMIN_AND_SUPPORT, <DashboardLayout />)}>
          <Route path="/agents" element={<AgentsPage />} />
        </Route>

        <Route element={protect(ADMIN, <DashboardLayout />)}>
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
