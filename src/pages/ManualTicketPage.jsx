import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ClipboardList,
  Info,
  Loader2,
  RefreshCw,
  Send,
  User,
} from 'lucide-react';

import DashboardLayout from '../components/layout/DashboardLayout';
import {
  createTicketWithAutoAssign,
  getCategories,
} from '../services/ticketService';

const transactionRequiredKeywords = [
  'payment',
  'withdrawal',
  'deposit',
  'p2p',
  'transaction',
  'transfer',
];

const initialFormData = {
  customerName: '',
  phone: '',
  telegram: '',
  email: '',
  accountId: '',
  channel: 'Telegram',
  issueType: '',
  subCategory: '',
  transactionId: '',
  issueDescription: '',
  internalNote: '',
};

const ManualTicketPage = () => {
  const [formData, setFormData] = useState(initialFormData);
  const [categories, setCategories] = useState([]);

  const [loadingCategories, setLoadingCategories] = useState(true);
  const [creatingTicket, setCreatingTicket] = useState(false);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      setErrorMessage('');

      const activeCategories = await getCategories();

      setCategories(activeCategories || []);

      if (activeCategories?.length > 0) {
        setFormData((prev) => ({
          ...prev,
          issueType: prev.issueType || activeCategories[0].name,
        }));
      }
    } catch (error) {
      console.error('Failed to load categories:', error);

      setErrorMessage(
        'Failed to load issue categories. Please check Supabase categories table or RLS policy.'
      );
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCategories();
  }, []);

  const isTransactionRequired = useMemo(() => {
    const issueType = formData.issueType.toLowerCase();

    return transactionRequiredKeywords.some((keyword) =>
      issueType.includes(keyword)
    );
  }, [formData.issueType]);

  const hasContact = useMemo(() => {
    return (
      formData.phone.trim() ||
      formData.telegram.trim() ||
      formData.email.trim()
    );
  }, [formData.phone, formData.telegram, formData.email]);

  const descriptionCount = formData.issueDescription.trim().length;

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (successMessage) setSuccessMessage('');
    if (errorMessage) setErrorMessage('');
  };

  const validateForm = () => {
    if (!formData.customerName.trim()) {
      setErrorMessage('Please enter the customer name.');
      return false;
    }

    if (!hasContact) {
      setErrorMessage(
        'Please enter at least one contact method: phone, Telegram, or email.'
      );
      return false;
    }

    if (!formData.channel) {
      setErrorMessage('Please select the customer contact channel.');
      return false;
    }

    if (!formData.issueType) {
      setErrorMessage('Please select an issue type.');
      return false;
    }

    if (isTransactionRequired && !formData.transactionId.trim()) {
      setErrorMessage(
        'Transaction ID is required for payment, withdrawal, deposit, transfer, transaction, or P2P issues.'
      );
      return false;
    }

    if (descriptionCount < 10) {
      setErrorMessage('Issue description must be at least 10 characters.');
      return false;
    }

    return true;
  };

  const resetForm = () => {
    setFormData({
      ...initialFormData,
      issueType: categories[0]?.name || '',
    });

    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSuccessMessage('');
    setErrorMessage('');

    if (!validateForm()) return;

    try {
      setCreatingTicket(true);

      const result = await createTicketWithAutoAssign(formData);

      if (result.assignedAgent) {
        setSuccessMessage(
          `Ticket created successfully and auto-assigned to ${result.assignedAgent.full_name}.`
        );
      } else {
        setSuccessMessage(
          'Ticket created successfully and placed in Waiting Queue because no agent is available.'
        );
      }

      resetForm();
    } catch (error) {
      console.error('Create ticket error:', error);

      setErrorMessage(
        error?.message ||
          'Failed to create ticket. Please check the browser console and Supabase table setup.'
      );
    } finally {
      setCreatingTicket(false);
    }
  };

  return (
    <DashboardLayout
      title="Manual Ticket"
      description="Create support tickets manually from Telegram, website chatbot, walk-in, phone call, office visit, or other channels."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-linear-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-sm">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-blue-100">
                <ClipboardList size={14} />
                Manual Ticket Entry
              </div>

              <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
                Create a trackable customer support ticket
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Use this form when an agent identifies a real customer issue and
                needs to record it in the Central Chat system.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MiniInfo label="Categories" value={categories.length} />
              <MiniInfo label="Channel" value={formData.channel} />
              <MiniInfo
                label="Contact"
                value={hasContact ? 'Ready' : 'Missing'}
              />
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-200 p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Ticket Information
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Required fields are marked with an asterisk. At least one
                  contact method is required.
                </p>
              </div>

              <button
                type="button"
                onClick={loadCategories}
                disabled={loadingCategories}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingCategories ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Refresh Categories
              </button>
            </div>
          </div>

          <div className="space-y-5 p-6">
            {successMessage && (
              <AlertBox
                type="success"
                icon={CheckCircle}
                message={successMessage}
              />
            )}

            {errorMessage && (
              <AlertBox
                type="error"
                icon={AlertCircle}
                message={errorMessage}
              />
            )}

            <AlertBox
              type="info"
              icon={Info}
              message="Required: customer name, at least one contact method, issue type, and issue description. Transaction ID is required for payment, withdrawal, deposit, transfer, transaction, or P2P issues."
            />

            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                <SectionCard
                  icon={User}
                  title="Customer Details"
                  description="Basic customer identity and contact information."
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Customer Name"
                      required
                      placeholder="Enter full name"
                      value={formData.customerName}
                      onChange={(value) => handleChange('customerName', value)}
                    />

                    <Input
                      label="Phone Number"
                      placeholder="Enter phone number"
                      value={formData.phone}
                      onChange={(value) => handleChange('phone', value)}
                    />

                    <Input
                      label="Telegram Username"
                      placeholder="@username"
                      value={formData.telegram}
                      onChange={(value) => handleChange('telegram', value)}
                    />

                    <Input
                      label="Email"
                      placeholder="customer@email.com"
                      value={formData.email}
                      onChange={(value) => handleChange('email', value)}
                    />

                    <Input
                      label="T.A Coin User ID"
                      placeholder="TAU-00000"
                      value={formData.accountId}
                      onChange={(value) => handleChange('accountId', value)}
                    />

                    <Select
                      label="Customer Contact Channel"
                      required
                      value={formData.channel}
                      onChange={(value) => handleChange('channel', value)}
                      helperText="Where the customer contacted us first."
                      options={[
                        'Telegram',
                        'Website Chatbot',
                        'Walk-in',
                        'Phone Call',
                        'Office Visit',
                        'Other',
                      ]}
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  icon={ClipboardList}
                  title="Issue Details"
                  description="Classify the customer issue clearly for follow-up."
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Issue Type <span className="text-red-500">*</span>
                      </label>

                      <select
                        value={formData.issueType}
                        onChange={(event) =>
                          handleChange('issueType', event.target.value)
                        }
                        disabled={
                          loadingCategories || categories.length === 0
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {loadingCategories ? (
                          <option>Loading categories...</option>
                        ) : categories.length === 0 ? (
                          <option>No active categories found</option>
                        ) : (
                          categories.map((category) => (
                            <option key={category.id} value={category.name}>
                              {category.name}
                            </option>
                          ))
                        )}
                      </select>

                      {categories.length === 0 && !loadingCategories && (
                        <p className="mt-2 text-xs text-red-500">
                          Please create an active category before creating
                          tickets.
                        </p>
                      )}
                    </div>

                    <Input
                      label="Sub-category"
                      placeholder="Example: Seller did not release coin"
                      value={formData.subCategory}
                      onChange={(value) => handleChange('subCategory', value)}
                    />

                    <Input
                      label="Transaction ID"
                      required={isTransactionRequired}
                      placeholder={
                        isTransactionRequired
                          ? 'Required for this issue type'
                          : 'Optional'
                      }
                      value={formData.transactionId}
                      onChange={(value) =>
                        handleChange('transactionId', value)
                      }
                    />
                  </div>

                  <div className="mt-4">
                    <Textarea
                      label="Issue Description"
                      required
                      rows={5}
                      value={formData.issueDescription}
                      onChange={(value) =>
                        handleChange('issueDescription', value)
                      }
                      placeholder="Describe the customer's issue clearly. Minimum 10 characters."
                      helperText={`${descriptionCount}/10 minimum characters`}
                    />
                  </div>

                  <div className="mt-4">
                    <Textarea
                      label="Internal Note"
                      rows={3}
                      value={formData.internalNote}
                      onChange={(value) => handleChange('internalNote', value)}
                      placeholder="Private note for staff only..."
                      helperText="This note is only visible internally."
                    />
                  </div>
                </SectionCard>
              </div>

              <aside className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="font-semibold text-slate-950">
                    Ticket Summary
                  </h3>

                  <div className="mt-4 space-y-3 text-sm">
                    <SummaryRow
                      label="Customer"
                      value={formData.customerName || 'Not entered'}
                    />

                    <SummaryRow
                      label="Channel"
                      value={formData.channel || 'Not selected'}
                    />

                    <SummaryRow
                      label="Issue Type"
                      value={formData.issueType || 'Not selected'}
                    />

                    <SummaryRow
                      label="Contact"
                      value={hasContact ? 'Available' : 'Missing'}
                      warning={!hasContact}
                    />

                    <SummaryRow
                      label="Transaction ID"
                      value={
                        formData.transactionId ||
                        (isTransactionRequired ? 'Required' : 'Optional')
                      }
                      warning={isTransactionRequired && !formData.transactionId}
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-700">
                  <div className="font-semibold">Auto-assignment logic</div>
                  <p className="mt-2 leading-6">
                    If an agent is available, this ticket will be automatically
                    assigned to the agent with the lowest active workload.
                    Otherwise, it will be placed in the Waiting Queue.
                  </p>
                </div>
              </aside>
            </div>
          </div>

          <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-200 p-6 sm:flex-row">
            <button
              type="button"
              onClick={resetForm}
              disabled={creatingTicket}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear Form
            </button>

            <button
              type="submit"
              disabled={
                creatingTicket || loadingCategories || categories.length === 0
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingTicket ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating Ticket...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Create Ticket
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

const MiniInfo = ({ label, value }) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-300">{label}</div>
    </div>
  );
};

const SectionCard = ({ icon: Icon, title, description, children }) => {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon size={19} />
        </div>

        <div>
          <h3 className="font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>

      {children}
    </section>
  );
};

const AlertBox = ({ type, icon: Icon, message }) => {
  const classes = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  return (
    <div
      className={`flex gap-3 rounded-2xl border p-4 text-sm ${classes[type]}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <p className="leading-6">{message}</p>
    </div>
  );
};

const Input = ({ label, placeholder, value, onChange, required = false }) => {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
      />
    </div>
  );
};

const Select = ({
  label,
  value,
  onChange,
  options,
  required = false,
  helperText,
}) => {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      {helperText && (
        <p className="mt-2 text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
};

const Textarea = ({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  required = false,
  helperText,
}) => {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
      />

      {helperText && (
        <p className="mt-2 text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
};

const SummaryRow = ({ label, value, warning = false }) => {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>

      <span
        className={`max-w-45 text-right font-medium ${
          warning ? 'text-red-600' : 'text-slate-900'
        }`}
      >
        {value}
      </span>
    </div>
  );
};

export default ManualTicketPage;