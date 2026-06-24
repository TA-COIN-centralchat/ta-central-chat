import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import DashboardPage from '../pages/DashboardPage';
import AllTicketsPage from '../pages/AllTicketsPage';
import LoginPage from '../pages/LoginPage';
import ManualTicketPage from '../pages/ManualTicketPage';
import AgentsPage from '../pages/AgentsPage';
import SettingsPage from '../pages/SettingsPage';
import WaitingQueuePage from '../pages/WaitingQueuePage';
import InvestigationPage from '../pages/InvestigationPage';
import ReadyToContactPage from '../pages/ReadyToContactPage';
import ClosedTicketsPage from '../pages/ClosedTicketsPage';
import CategoriesPage from '../pages/CategoriesPage';
import ReportsPage from '../pages/ReportsPage';
import ChannelTicketsPage from '../pages/ChannelTicketsPage';
import AuditLogsPage from '../pages/AuditLogsPage';
import CustomersPage from '../pages/CustomersPage';
import TicketDetailPage from '../pages/TicketDetailPage';
import SessionWorkspacePage from '../pages/SessionWorkspacePage';
import LiveChatPage from '../pages/LiveChatPage';

import ProtectedRoute from './ProtectedRoute';

const ADMIN = ['Admin'];

const ALL_ROLES = [
  'Admin',
  'Customer Service Agent',
  'Customer Support Agent',
];

const protect = (roles, element) => (
  <ProtectedRoute allowedRoles={roles}>{element}</ProtectedRoute>
);

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route
          path="/dashboard"
          element={protect(ALL_ROLES, <DashboardPage />)}
        />

        <Route
          path="/tickets"
          element={protect(ALL_ROLES, <AllTicketsPage />)}
        />

        <Route
          path="/tickets/:ticketId"
          element={protect(ALL_ROLES, <TicketDetailPage />)}
        />

        <Route
          path="/waiting-queue"
          element={protect(ALL_ROLES, <WaitingQueuePage />)}
        />

        <Route
          path="/investigation"
          element={protect(ALL_ROLES, <InvestigationPage />)}
        />

        <Route
          path="/ready-to-contact"
          element={protect(ALL_ROLES, <ReadyToContactPage />)}
        />

        <Route
          path="/closed"
          element={protect(ALL_ROLES, <ClosedTicketsPage />)}
        />

        <Route
          path="/manual-ticket"
          element={protect(ALL_ROLES, <ManualTicketPage />)}
        />

        <Route
          path="/live-chat"
          element={protect(ALL_ROLES, <LiveChatPage />)}
        />

        <Route
          path="/chatbot"
          element={protect(
            ALL_ROLES,
            <ChannelTicketsPage
              channelName="Website Chatbot"
              title="Chatbot Sessions"
              description="Customer conversations from the website chatbot."
              workspaceBasePath="/chatbot"
            />
          )}
        />

        <Route
          path="/telegram"
          element={protect(
            ALL_ROLES,
            <ChannelTicketsPage
              channelName="Telegram"
              title="Telegram Sessions"
              description="Customer conversations from the Telegram bot."
              workspaceBasePath="/telegram"
            />
          )}
        />

        <Route
          path="/whatsapp"
          element={protect(
            ALL_ROLES,
            <ChannelTicketsPage
              channelName="WhatsApp"
              title="WhatsApp Sessions"
              description="Customer conversations from WhatsApp (Cloud API)."
              workspaceBasePath="/whatsapp"
            />
          )}
        />

        <Route
          path="/chatbot/:sessionId"
          element={protect(ALL_ROLES, <SessionWorkspacePage />)}
        />

        <Route
          path="/live-chat/:sessionId"
          element={protect(ALL_ROLES, <SessionWorkspacePage />)}
        />

        <Route
          path="/telegram/:sessionId"
          element={protect(ALL_ROLES, <SessionWorkspacePage />)}
        />

        <Route
          path="/whatsapp/:sessionId"
          element={protect(ALL_ROLES, <SessionWorkspacePage />)}
        />

        <Route
          path="/customers"
          element={protect(ALL_ROLES, <CustomersPage />)}
        />

        <Route
          path="/categories"
          element={protect(ADMIN, <CategoriesPage />)}
        />

        <Route
          path="/reports"
          element={protect(ADMIN, <ReportsPage />)}
        />

        <Route
          path="/audit-logs"
          element={protect(ADMIN, <AuditLogsPage />)}
        />

        <Route
          path="/agents"
          element={protect(ADMIN, <AgentsPage />)}
        />

        <Route
          path="/settings"
          element={protect(ADMIN, <SettingsPage />)}
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;