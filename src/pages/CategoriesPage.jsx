import { useEffect, useMemo, useState } from 'react';
import { FolderPlus, Loader2, Plus, Search, Tags } from 'lucide-react';

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
        <div className="mx-auto max-w-7xl">
          <section className="overflow-hidden rounded-[28px] border border-black/6 bg-white/90 shadow-[0_14px_40px_rgba(0,0,0,0.035)] backdrop-blur">
            <div className="flex flex-col justify-between gap-4 border-b border-black/6 px-5 py-4 lg:flex-row lg:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
                  <Tags size={18} />
                </div>

                <div>
                  <h2 className="text-base font-semibold text-[#1d1d1f]">
                    Issue Categories
                  </h2>

                  <p className="mt-0.5 text-sm text-[#6e6e73]">
                    {filteredCategories.length} of {categories.length}{' '}
                    categories shown.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateCategory(true)}
                className="inline-flex w-fit items-center justify-center gap-2 rounded-2xl bg-[#43acd6] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.22)] transition hover:bg-[#2389b8]"
              >
                <Plus size={16} />
                Add Category
              </button>
            </div>

            <div className="border-b border-black/6 px-5 py-4">
              <div className="system-input flex h-11 max-w-xl items-center gap-3 rounded-2xl px-4">
                <Search size={16} className="shrink-0 text-[#8e8e93]" />

                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search category name, description, or status..."
                  className="w-full bg-transparent text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-44 items-center justify-center p-8 text-sm text-[#6e6e73]">
                <div className="text-center">
                  <Loader2
                    size={24}
                    className="mx-auto mb-3 animate-spin text-[#43acd6]"
                  />
                  Loading categories...
                </div>
              </div>
            ) : filteredCategories.length === 0 ? (
              <EmptyState onCreate={() => setShowCreateCategory(true)} />
            ) : (
              <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredCategories.map((category) => {
                  const ticketCount = getTicketCount(category.name);

                  return (
                    <article
                      key={category.id}
                      className="group rounded-3xl border border-black/6 bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.025)] transition hover:-translate-y-0.5 hover:border-[#43acd6]/25 hover:shadow-[0_16px_40px_rgba(67,172,214,0.10)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8] ring-1 ring-[#43acd6]/15">
                              <Tags size={18} />
                            </div>

                            <div className="min-w-0">
                              <h3
                                title={category.name}
                                className="truncate text-sm font-semibold text-[#1d1d1f]"
                              >
                                {category.name}
                              </h3>

                              <p className="mt-1 text-xs text-[#8e8e93]">
                                {ticketCount} related{' '}
                                {ticketCount === 1 ? 'ticket' : 'tickets'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <StatusBadge status={category.status} />
                      </div>

                      <p
                        title={category.description || 'No description provided.'}
                        className="mt-4 line-clamp-3 min-h-15 text-sm leading-6 text-[#6e6e73]"
                      >
                        {category.description || 'No description provided.'}
                      </p>

                      <div className="mt-5 flex items-center justify-between border-t border-black/6 pt-4">
                        <span className="text-xs font-medium text-[#8e8e93]">
                          Category
                        </span>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded-2xl border border-black/[0.07] bg-[#f5f5f7] px-3 py-2 text-xs font-medium text-[#6e6e73] transition hover:bg-white hover:text-[#1d1d1f]"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="rounded-2xl border border-black/[0.07] bg-white px-3 py-2 text-xs font-medium text-[#6e6e73] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                          >
                            Disable
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
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

const StatusBadge = ({ status }) => {
  const isActive = status === 'Active';

  return (
    <span
      title={status}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${
        isActive
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
          : 'bg-slate-100 text-slate-600 ring-slate-200'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isActive ? 'bg-emerald-500' : 'bg-slate-400'
        }`}
      />
      {status || 'Inactive'}
    </span>
  );
};

const EmptyState = ({ onCreate }) => {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
        <FolderPlus size={22} />
      </div>

      <h3 className="mt-4 font-semibold text-[#1d1d1f]">
        No categories found
      </h3>

      <p className="mt-2 text-sm text-[#6e6e73]">
        Try changing your search keyword or add a new category.
      </p>

      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#43acd6] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.22)] transition hover:bg-[#2389b8]"
      >
        <Plus size={16} />
        Add Category
      </button>
    </div>
  );
};

export default CategoriesPage;