import { useEffect, useMemo, useState, useCallback } from "react";
import { Search, UserCircle } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import DashboardLayout from "../components/layout/DashboardLayout";

const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [customerRes, ticketRes] = await Promise.all([
        supabase
          .from("customers")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("tickets").select("id, customer_id, status"),
      ]);

      if (customerRes.error) throw customerRes.error;
      if (ticketRes.error) throw ticketRes.error;

      setCustomers(customerRes.data || []);
      setTickets(ticketRes.data || []);
    } catch (error) {
      console.error("Failed to load customer records:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Optimization: Pre-calculate counts to avoid O(N*M) filtering in the render loop
  const customerStats = useMemo(() => {
    const stats = {};
    tickets.forEach((ticket) => {
      const cid = ticket.customer_id;
      if (!cid) return;
      if (!stats[cid]) {
        stats[cid] = { total: 0, open: 0 };
      }
      stats[cid].total += 1;
      if (ticket.status !== "Resolved" && ticket.status !== "Closed") {
        stats[cid].open += 1;
      }
    });
    return stats;
  }, [tickets]);

  const filteredCustomers = useMemo(() => {
    const searchValue = searchTerm.toLowerCase().trim();

    if (!searchValue) return customers;

    return customers.filter((customer) => {
      return (
        customer.full_name?.toLowerCase().includes(searchValue) ||
        customer.phone?.toLowerCase().includes(searchValue) ||
        customer.email?.toLowerCase().includes(searchValue) ||
        customer.telegram_username?.toLowerCase().includes(searchValue) ||
        customer.ta_coin_user_id?.toLowerCase().includes(searchValue) ||
        customer.source_channel?.toLowerCase().includes(searchValue)
      );
    });
  }, [customers, searchTerm]);

  return (
    <DashboardLayout
      title="Customers"
      description="View customer profiles and support history."
    >
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="font-semibold text-slate-950">Customer Records</h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredCustomers.length} of {customers.length} customers shown.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 h-10 px-3 transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50 md:w-96">
            <Search size={16} className="text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search name, contact, ID..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Telegram</th>
                  <th className="px-5 py-3">T.A Coin ID</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Tickets</th>
                  <th className="px-5 py-3">Open</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 w-24 rounded bg-slate-100"></div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-lg font-semibold text-slate-900">
              No customers found
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Try changing your search keyword.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Telegram</th>
                  <th className="px-5 py-3">T.A Coin ID</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Tickets</th>
                  <th className="px-5 py-3">Open</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <UserCircle size={20} />
                        </div>
                        <span className="font-medium text-slate-900">{customer.full_name}</span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {customer.phone || "N/A"}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {customer.email || "N/A"}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {customer.telegram_username || "N/A"}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {customer.ta_coin_user_id || "N/A"}
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                        {customer.source_channel || "Unknown"}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {customerStats[customer.id]?.total || 0}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {customerStats[customer.id]?.open || 0}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {customer.created_at
                        ? new Date(customer.created_at).toLocaleDateString()
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CustomersPage;
