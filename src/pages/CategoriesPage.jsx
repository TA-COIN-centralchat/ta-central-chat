import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import CreateCategoryModal from '../components/categories/CreateCategoryModal';
import { supabase } from '../services/supabaseClient';

const CategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateCategory, setShowCreateCategory] = useState(false);

  const loadCategories = async () => {
    try {
      setLoading(true);

      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: false });

      if (categoryError) {
        throw categoryError;
      }

      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select('issue_type');

      if (ticketError) {
        throw ticketError;
      }

      setCategories(categoryData || []);
      setTickets(ticketData || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCategories();
  }, []);

  const getTicketCount = (categoryName) => {
    return tickets.filter((ticket) => ticket.issue_type === categoryName).length;
  };

  const filteredCategories = useMemo(() => {
    const searchValue = searchTerm.toLowerCase().trim();

    if (!searchValue) return categories;

    return categories.filter((category) => {
      return (
        category.name?.toLowerCase().includes(searchValue) ||
        category.description?.toLowerCase().includes(searchValue) ||
        category.status?.toLowerCase().includes(searchValue)
      );
    });
  }, [categories, searchTerm]);

  return (
    <>
      <DashboardLayout
        title="Categories"
        description="Manage issue categories for customer support tickets."
      >
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-950">
                  Issue Categories
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredCategories.length} of {categories.length} categories shown.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateCategory(true)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Add Category
              </button>
            </div>

            <div className="mt-5">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search category name, description, or status..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 md:w-96"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading categories...
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-lg font-semibold text-slate-900">
                No categories found
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Try changing your search keyword or add a new category.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredCategories.map((category) => (
                <div
                  key={category.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-950">
                        {category.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {getTicketCount(category.name)} related tickets
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        category.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {category.status}
                    </span>
                  </div>

                  <p className="mt-4 min-h-12 text-sm leading-relaxed text-slate-600">
                    {category.description || 'No description provided.'}
                  </p>

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
          )}
        </div>
      </DashboardLayout>

      <CreateCategoryModal
        open={showCreateCategory}
        onClose={() => setShowCreateCategory(false)}
        onCreated={loadCategories}
      />
    </>
  );
};

export default CategoriesPage;