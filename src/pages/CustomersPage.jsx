import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { supabase } from '../services/supabaseClient';

const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setLoading(true);

        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .order('created_at', { ascending: false });

        if (customerError) {
          throw customerError;
        }

        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select('id, customer_id, status');

        if (ticketError) {
          throw ticketError;
        }

        setCustomers(customerData || []);
        setTickets(ticketData || []);
      } catch (error) {
        console.error('Failed to load customers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCustomers();
  }, []);

  const getTicketCount = (customerId) => {
    return tickets.filter((ticket) => ticket.customer_id === customerId).length;
  };

  const getOpenTicketCount = (customerId) => {
    return tickets.filter(
      (ticket) =>
        ticket.customer_id === customerId &&
        ticket.status !== 'Resolved' &&
        ticket.status !== 'Closed'
    ).length;
  };

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

          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search name, phone, email, Telegram, T.A Coin ID..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 md:w-96"
          />
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading customers...
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
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {customer.full_name}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {customer.phone || 'N/A'}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {customer.email || 'N/A'}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {customer.telegram_username || 'N/A'}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {customer.ta_coin_user_id || 'N/A'}
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                        {customer.source_channel || 'Unknown'}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {getTicketCount(customer.id)}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {getOpenTicketCount(customer.id)}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {customer.created_at
                        ? new Date(customer.created_at).toLocaleDateString()
                        : 'N/A'}
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