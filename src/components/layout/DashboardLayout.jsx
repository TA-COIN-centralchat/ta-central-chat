import Sidebar from './Sidebar';
import Topbar from './Topbar';

const DashboardLayout = ({ children, title, description }) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        <Sidebar />

        <main className="ml-72 min-h-screen flex-1">
          <Topbar title={title} description={description} />
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;