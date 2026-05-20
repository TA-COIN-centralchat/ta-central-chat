import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import DashboardPage from '../pages/DashboardPage';
import AllTicketsPage from '../pages/AllTicketsPage';
import TicketDetailPage from '../pages/TicketDetailPage';
import LoginPage from '../pages/LoginPage';
import ManualTicketPage from '../pages/ManualTicketPage';
import AgentsPage from '../pages/AgentsPage';
import SettingsPage from '../pages/SettingsPage';
import WaitingQueuePage from '../pages/WaitingQueuePage';
import InvestigationPage from '../pages/InvestigationPage';
import ClosedTicketsPage from '../pages/ClosedTicketsPage';
import CategoriesPage from '../pages/CategoriesPage';
import ReportsPage from '../pages/ReportsPage';
import ChannelTicketsPage from '../pages/ChannelTicketsPage';
import AuditLogsPage from '../pages/AuditLogsPage';
import CustomersPage from '../pages/CustomersPage';
import LiveChatPage from '../pages/LiveChatPage';
import ProtectedRoute from './ProtectedRoute';

const ADMIN = ['Admin'];

const ALL_ROLES = [
  'Admin',
  'Customer Service Agent',
  'Customer Support Agent',
];

const ADMIN_AND_SERVICE = ['Admin', 'Customer Service Agent'];

const ADMIN_AND_SUPPORT = ['Admin', 'Customer Support Agent'];

const SERVICE_AND_SUPPORT = [
  'Admin',
  'Customer Service Agent',
  'Customer Support Agent',
];

const ComingSoonPage = ({ title }) => {
  return (
    <div className="min-h-screen bg-slate-50 p-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-2 text-slate-500">
          This page is not built yet. We will add it later.
        </p>
      </div>
    </div>
  );
};

const protect = (allowedRoles, element) => {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      {element}
    </ProtectedRoute>
  );
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/tickets" replace />} />

        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={protect(ALL_ROLES, <DashboardPage />)}
        />

        <Route
          path="/tickets"
          element={protect(SERVICE_AND_SUPPORT, <AllTicketsPage />)}
        />

        <Route
          path="/tickets/:ticketId"
          element={protect(SERVICE_AND_SUPPORT, <TicketDetailPage />)}
        />

        <Route
          path="/chatbot"
          element={protect(
            ADMIN_AND_SERVICE,
            <ChannelTicketsPage
              channelName="Website Chatbot"
              title="Chatbot Tickets"
              description="Manage tickets received from the landing page chatbot."
              workspaceBasePath="/chatbot"
            />
          )}
        />

        <Route
          path="/chatbot/:ticketId"
          element={protect(ADMIN_AND_SERVICE, <TicketDetailPage />)}
        />

        <Route
          path="/live-chat"
          element={protect(ADMIN_AND_SERVICE, <LiveChatPage />)}
        />

        <Route
          path="/telegram"
          element={protect(
            ADMIN_AND_SERVICE,
            <ChannelTicketsPage
              channelName="Telegram"
              title="Telegram Tickets"
              description="Manage tickets received from the T.A Coin Telegram Bot."
              workspaceBasePath="/telegram"
            />
          )}
        />

        <Route
          path="/telegram/:ticketId"
          element={protect(ADMIN_AND_SERVICE, <TicketDetailPage />)}
        />

        <Route
          path="/manual-ticket"
          element={protect(ADMIN_AND_SERVICE, <ManualTicketPage />)}
        />

        <Route
          path="/waiting-queue"
          element={protect(ADMIN_AND_SERVICE, <WaitingQueuePage />)}
        />

        <Route
          path="/pending-investigation"
          element={protect(ADMIN_AND_SUPPORT, <InvestigationPage />)}
        />

        <Route
          path="/closed-tickets"
          element={protect(SERVICE_AND_SUPPORT, <ClosedTicketsPage />)}
        />

        <Route
          path="/customers"
          element={protect(SERVICE_AND_SUPPORT, <CustomersPage />)}
        />

        <Route
          path="/agents"
          element={protect(ADMIN, <AgentsPage />)}
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
          path="/settings"
          element={protect(ADMIN, <SettingsPage />)}
        />

        <Route
          path="/account-management"
          element={protect(ADMIN, <ComingSoonPage title="Account Management" />)}
        />

        <Route
          path="/popups"
          element={protect(ADMIN, <ComingSoonPage title="Popups" />)}
        />

        <Route
          path="/news-portal"
          element={protect(ADMIN, <ComingSoonPage title="News Portal" />)}
        />

        <Route
          path="/job-applications"
          element={protect(ADMIN, <ComingSoonPage title="Job Applications" />)}
        />

        <Route path="*" element={<Navigate to="/tickets" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;