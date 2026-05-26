import { useEffect, useMemo, useState, useCallback } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import CreateCategoryModal from "../components/categories/CreateCategoryModal";
import { supabase } from "../services/supabaseClient";

const CategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateCategory, setShowCreateCategory] = useState(false);

  // FIXED: Properly wrapped inside a useCallback hook
  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);

      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("*")
        .order("created_at", { ascending: false });

      if (categoryError) {
        throw categoryError;
      }

      const { data: ticketData, error: ticketError } = await supabase
        .from("tickets")
        .select("issue_type");

      if (ticketError) {
        throw ticketError;
      }

      setCategories(categoryData || []);
      setTickets(ticketData || []);
    } catch (error) {
      console.error("Failed to load categories:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

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

              {/* REFINED: Explicitly centered text tracking layout */}
              <button
                type="button"
                onClick={() => setShowCreateCategory(true)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition-all hover:bg-blue-700 active:scale-[0.98]"
              >
                + Add Category
              </button>
            </div>

            <div className="mt-5">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search category name, description, or status..."
                className="w-full rounded-xl border border-slate-200 h-10 px-3 text-sm outline-none focus:border-blue-500 md:w-96"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="h-6 w-32 rounded bg-slate-100"></div>
                    <div className="h-5 w-16 rounded-full bg-slate-100"></div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-4 w-full rounded bg-slate-100"></div>
                    <div className="h-4 w-2/3 rounded bg-slate-100"></div>
                  </div>
                  <div className="mt-5 flex gap-2">
                    <div className="h-10 w-16 rounded-xl bg-slate-100"></div>
                    <div className="h-10 w-20 rounded-xl bg-slate-100"></div>
                  </div>
                </div>
              ))}
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
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="truncate">
                        <h3 className="truncate font-semibold text-slate-950" title={category.name}>
                          {category.name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {getTicketCount(category.name)} related tickets
                        </p>
                      </div>

                      {/* REFINED: Perfectly centered badge text alignment */}
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium shrink-0 leading-none ${
                          category.status === "Active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {category.status}
                      </span>
                    </div>

                    <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-slate-600" title={category.description}>
                      {category.description || "No description provided."}
                    </p>
                  </div>

                  {/* REFINED: Balanced action row spacing and centered fonts */}
                  <div className="mt-5 flex items-center gap-2 pt-1">
                    <button className="inline-flex h-9 flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100">
                      Edit
                    </button>

                    <button className="inline-flex h-9 flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 active:bg-slate-100">
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