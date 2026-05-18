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

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/tickets" replace />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/tickets" element={<AllTicketsPage />} />
        <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />

        <Route
          path="/chatbot"
          element={
            <ChannelTicketsPage
              channelName="Website Chatbot"
              title="Chatbot Tickets"
              description="Manage tickets received from the landing page chatbot."
              workspaceBasePath="/chatbot"
            />
          }
        />
        <Route path="/chatbot/:ticketId" element={<TicketDetailPage />} />

        <Route
          path="/telegram"
          element={
            <ChannelTicketsPage
              channelName="Telegram"
              title="Telegram Tickets"
              description="Manage tickets received from the T.A Coin Telegram Bot."
              workspaceBasePath="/telegram"
            />
          }
        />
        <Route path="/telegram/:ticketId" element={<TicketDetailPage />} />

        <Route path="/manual-ticket" element={<ManualTicketPage />} />
        <Route path="/waiting-queue" element={<WaitingQueuePage />} />
        <Route path="/pending-investigation" element={<InvestigationPage />} />
        <Route path="/closed-tickets" element={<ClosedTicketsPage />} />

        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />

        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        <Route path="/account-management" element={<ComingSoonPage title="Account Management" />} />
        <Route path="/popups" element={<ComingSoonPage title="Popups" />} />
        <Route path="/news-portal" element={<ComingSoonPage title="News Portal" />} />
        <Route path="/job-applications" element={<ComingSoonPage title="Job Applications" />} />

        <Route path="*" element={<Navigate to="/tickets" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;