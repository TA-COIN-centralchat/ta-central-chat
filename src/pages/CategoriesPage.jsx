import DashboardLayout from '../components/layout/DashboardLayout';

const categories = [
  {
    id: 1,
    name: 'Payment Issue',
    subCategories: ['Payment not received', 'Wrong amount', 'Payment verification needed'],
    status: 'Active',
    tickets: 18,
  },
  {
    id: 2,
    name: 'Withdrawal Issue',
    subCategories: ['Withdrawal pending', 'Withdrawal failed', 'Transaction hash issue'],
    status: 'Active',
    tickets: 12,
  },
  {
    id: 3,
    name: 'P2P Issue',
    subCategories: ['Seller did not release coin', 'Buyer did not pay', 'Dispute evidence needed'],
    status: 'Active',
    tickets: 9,
  },
  {
    id: 4,
    name: 'Login Issue',
    subCategories: ['Forgot password', '2FA problem', 'Account locked'],
    status: 'Active',
    tickets: 7,
  },
  {
    id: 5,
    name: 'KYC Issue',
    subCategories: ['KYC rejected', 'Document update needed', 'Verification pending'],
    status: 'Active',
    tickets: 5,
  },
];

const CategoriesPage = () => {
  return (
    <DashboardLayout
      title="Categories"
      description="Manage issue categories and sub-categories for tickets."
    >
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="font-semibold text-slate-950">Issue Categories</h2>
            <p className="mt-1 text-sm text-slate-500">
              Categories help agents classify customer issues correctly.
            </p>
          </div>

          <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Add Category
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-950">{category.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {category.tickets} related tickets
                  </p>
                </div>

                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                  {category.status}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {category.subCategories.map((sub) => (
                  <div
                    key={sub}
                    className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  >
                    {sub}
                  </div>
                ))}
              </div>

              <div className="mt-5 flex gap-2">
                <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                  Edit
                </button>
                <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50">
                  Disable
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CategoriesPage;