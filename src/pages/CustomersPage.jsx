import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Users } from 'lucide-react';

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
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[28px] border border-black/6 bg-white/90 shadow-[0_14px_40px_rgba(0,0,0,0.035)] backdrop-blur">
          <div className="flex flex-col justify-between gap-4 border-b border-black/6 px-5 py-4 lg:flex-row lg:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
                <Users size={19} />
              </div>

              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">
                  Customer Records
                </h2>

                <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
                  {filteredCustomers.length} of {customers.length} customers
                  shown.
                </p>
              </div>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#f5f5f7] px-3 py-2 text-sm font-medium text-[#6e6e73] ring-1 ring-black/6">
              <span className="h-2 w-2 rounded-full bg-[#43acd6]" />
              Customer database
            </div>
          </div>

          <div className="border-b border-black/6 px-5 py-4">
            <div className="system-input flex h-11 max-w-2xl items-center gap-3 rounded-2xl px-4">
              <Search size={16} className="shrink-0 text-[#8e8e93]" />

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search name, phone, email, Telegram, T.A Coin ID..."
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
                Loading customers...
              </div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-280 table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-57.5" />
                  <col className="w-37.5" />
                  <col className="w-60" />
                  <col className="w-45" />
                  <col className="w-42.5" />
                  <col className="w-35" />
                  <col className="w-27.5" />
                  <col className="w-25" />
                  <col className="w-35" />
                </colgroup>

                <thead className="bg-[#f5f5f7] text-[11px] uppercase tracking-[0.16em] text-[#8e8e93]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Phone</th>
                    <th className="px-5 py-3 font-semibold">Email</th>
                    <th className="px-5 py-3 font-semibold">Telegram</th>
                    <th className="px-5 py-3 font-semibold">T.A Coin ID</th>
                    <th className="px-5 py-3 font-semibold">Source</th>
                    <th className="px-5 py-3 font-semibold">Tickets</th>
                    <th className="px-5 py-3 font-semibold">Open</th>
                    <th className="px-5 py-3 font-semibold">Created</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-black/5">
                  {filteredCustomers.map((customer) => {
                    const ticketCount = getTicketCount(customer.id);
                    const openTicketCount = getOpenTicketCount(customer.id);
                    const createdDate = customer.created_at
                      ? new Date(customer.created_at).toLocaleDateString()
                      : 'N/A';

                    return (
                      <tr
                        key={customer.id}
                        className="transition hover:bg-[#f8fafc]"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef9fd] text-sm font-semibold text-[#2389b8] ring-1 ring-[#43acd6]/15">
                              {getInitials(customer.full_name)}
                            </div>

                            <div className="min-w-0">
                              <div
                                title={customer.full_name}
                                className="truncate font-semibold text-[#1d1d1f]"
                              >
                                {customer.full_name || 'Unknown customer'}
                              </div>

                              <div
                                title={customer.id}
                                className="mt-1 truncate text-xs text-[#8e8e93]"
                              >
                                ID: {shortId(customer.id)}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <div
                            title={customer.phone || 'N/A'}
                            className="truncate text-[#6e6e73]"
                          >
                            {customer.phone || 'N/A'}
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <div
                            title={customer.email || 'N/A'}
                            className="truncate text-[#6e6e73]"
                          >
                            {customer.email || 'N/A'}
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <div
                            title={customer.telegram_username || 'N/A'}
                            className="truncate text-[#6e6e73]"
                          >
                            {customer.telegram_username || 'N/A'}
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <div
                            title={customer.ta_coin_user_id || 'N/A'}
                            className="truncate text-[#6e6e73]"
                          >
                            {customer.ta_coin_user_id || 'N/A'}
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <span
                            title={customer.source_channel || 'Unknown'}
                            className="inline-flex max-w-full rounded-full bg-[#eef9fd] px-3 py-1 text-xs font-medium text-[#2389b8] ring-1 ring-[#43acd6]/15"
                          >
                            <span className="truncate">
                              {customer.source_channel || 'Unknown'}
                            </span>
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <CountBadge value={ticketCount} tone="blue" />
                        </td>

                        <td className="px-5 py-3.5">
                          <CountBadge
                            value={openTicketCount}
                            tone={openTicketCount > 0 ? 'orange' : 'slate'}
                          />
                        </td>

                        <td className="whitespace-nowrap px-5 py-3.5">
                          <div
                            title={createdDate}
                            className="truncate text-[#6e6e73]"
                          >
                            {createdDate}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

const CountBadge = ({ value, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-[#eef9fd] text-[#2389b8] ring-[#43acd6]/15',
    orange: 'bg-orange-50 text-orange-700 ring-orange-100',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  };

  return (
    <span
      className={`inline-flex min-w-8 justify-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tones[tone]}`}
    >
      {value}
    </span>
  );
};

const EmptyState = () => {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
        <Users size={22} />
      </div>

      <h3 className="mt-4 font-semibold text-[#1d1d1f]">
        No customers found
      </h3>

      <p className="mt-2 text-sm text-[#6e6e73]">
        Try changing your search keyword.
      </p>
    </div>
  );
};

const getInitials = (name = '') => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || 'C';
};

const shortId = (id) => {
  if (!id) return 'N/A';

  return String(id).length > 10 ? `${String(id).slice(0, 8)}...` : id;
};

export default CustomersPage;