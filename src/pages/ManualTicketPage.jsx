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
import { useLocation } from 'react-router-dom';

import DashboardLayout from '../components/layout/DashboardLayout';
import {
  createTicketWithAutoAssign,
  getCategories,
} from '../services/ticketService';

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
  const location = useLocation();
  // Live chat and session workspace pages navigate here with a state payload
  // (customer name, phone, channel, issue text, etc.) so the form starts
  // pre-filled. Without this merge the prefill is silently dropped.
  const presetData = location.state || {};

  const [formData, setFormData] = useState(() => ({
    ...initialFormData,
    customerName: presetData.customerName || '',
    phone: presetData.phone || '',
    telegram: presetData.telegram || '',
    email: presetData.email || '',
    accountId: presetData.accountId || '',
    channel: presetData.channel || initialFormData.channel,
    issueDescription: presetData.issueDescription || '',
    internalNote: presetData.internalNote || '',
  }));
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

    if (!formData.email.trim()) {
      setErrorMessage('Please enter the customer email.');
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
      description="Create support tickets manually from any channel. All fields marked with * are required."
    >
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <form onSubmit={handleSubmit} className="space-y-5">
            {(successMessage || errorMessage) && (
              <div className="space-y-3">
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
              </div>
            )}

            <SectionCard
              icon={User}
              title="Customer Information"
              description="Enter the customer's details and contact information."
              action={
                <button
                  type="button"
                  onClick={loadCategories}
                  disabled={loadingCategories}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/[0.07] bg-[#f5f5f7] px-3 py-2 text-xs font-medium text-[#6e6e73] transition hover:bg-white hover:text-[#1d1d1f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingCategories ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <RefreshCw size={15} />
                  )}
                  Refresh
                </button>
              }
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Input
                  label="Customer Name"
                  required
                  placeholder="Enter customer name"
                  value={formData.customerName}
                  onChange={(value) => handleChange('customerName', value)}
                />

                <Input
                  label="Phone"
                  placeholder="e.g. +1234567890"
                  value={formData.phone}
                  onChange={(value) => handleChange('phone', value)}
                />

                <Input
                  label="Telegram"
                  placeholder="e.g. @username"
                  value={formData.telegram}
                  onChange={(value) => handleChange('telegram', value)}
                />

                <Input
                  label="Email"
                  required
                  placeholder="e.g. customer@email.com"
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
                  label="Contact Channel"
                  required
                  value={formData.channel}
                  onChange={(value) => handleChange('channel', value)}
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
              title="Ticket Details"
              description="Classify the issue clearly so the ticket can be assigned correctly."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="issueType" className="text-sm font-medium text-[#1d1d1f]">
                    Issue Type <span className="text-red-500">*</span>
                  </label>

                  <select
                    id="issueType"
                    name="issueType"
                    value={formData.issueType}
                    onChange={(event) =>
                      handleChange('issueType', event.target.value)
                    }
                    disabled={loadingCategories || categories.length === 0}
                    className="system-select mt-2"
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
                      Please create an active category before creating tickets.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <Textarea
                  label="Issue Description"
                  rows={5}
                  value={formData.issueDescription}
                  onChange={(value) => handleChange('issueDescription', value)}
                  placeholder="Describe the issue in detail..."
                  helperText={`${descriptionCount}/10 minimum characters`}
                />
              </div>

              <div className="mt-4">
                <Textarea
                  label="Internal Note"
                  rows={4}
                  value={formData.internalNote}
                  onChange={(value) => handleChange('internalNote', value)}
                  placeholder="Add internal notes. Not visible to customer..."
                  helperText="This note is only visible internally."
                />
              </div>

              <div className="mt-6 flex justify-end border-t border-black/6 pt-5">
                <button
                  type="submit"
                  disabled={
                    creatingTicket || loadingCategories || categories.length === 0
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#43acd6] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.22)] transition hover:bg-[#2389b8] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingTicket ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Creating Ticket...
                    </>
                  ) : (
                    <>
                      Create Ticket
                      <Send size={16} />
                    </>
                  )}
                </button>
              </div>
            </SectionCard>
          </form>

          <aside className="space-y-5">
            <div className="rounded-[28px] border border-black/6 bg-white/85 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.04)] backdrop-blur">
              <h3 className="text-sm font-semibold text-[#1d1d1f]">
                Ticket Summary
              </h3>

              <div className="mt-4 space-y-3 text-sm">
                <SummaryRow
                  label="Customer"
                  value={formData.customerName || 'Not entered'}
                />

                <SummaryRow
                  label="Email"
                  value={formData.email || 'Required'}
                  warning={!formData.email}
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
              </div>
            </div>

            <div className="rounded-[28px] border border-[#43acd6]/20 bg-[#eef9fd] p-5 text-sm text-[#2389b8]">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/80 text-[#2389b8]">
                  <Info size={18} />
                </div>

                <div>
                  <div className="font-semibold">Tip</div>
                  <p className="mt-1 text-xs text-[#2389b8]/80">
                    Auto-assignment
                  </p>
                </div>
              </div>

              <p className="mt-4 leading-6">
                After creating, the ticket will be auto-assigned to an available
                agent or placed in the Waiting Queue.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
};

const SectionCard = ({ icon: Icon, title, description, action, children }) => {
  return (
    <section className="rounded-[28px] border border-black/6 bg-white/85 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.04)] backdrop-blur">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#eef9fd] text-[#2389b8]">
            <Icon size={18} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#1d1d1f]">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-[#6e6e73]">
              {description}
            </p>
          </div>
        </div>

        {action}
      </div>

      {children}
    </section>
  );
};

const AlertBox = ({ type, icon: Icon, message }) => {
  const classes = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-[#43acd6]/20 bg-[#eef9fd] text-[#2389b8]',
  };

  return (
    <div
      className={`flex gap-3 rounded-2xl border px-4 py-3 text-sm ${classes[type]}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <p className="leading-6">{message}</p>
    </div>
  );
};

const Input = ({ label, placeholder, value, onChange, required = false }) => {
  const inputId = label.replace(/\s+/g, '-').toLowerCase();
  return (
    <div>
      <label htmlFor={inputId} className="text-sm font-medium text-[#1d1d1f]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <input
        id={inputId}
        name={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="system-input mt-2 w-full rounded-2xl px-4 py-3 text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
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
  const selectId = label.replace(/\s+/g, '-').toLowerCase();
  return (
    <div>
      <label htmlFor={selectId} className="text-sm font-medium text-[#1d1d1f]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <select
        id={selectId}
        name={selectId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="system-select mt-2"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      {helperText && <p className="mt-2 text-xs text-[#6e6e73]">{helperText}</p>}
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
  const textareaId = label.replace(/\s+/g, '-').toLowerCase();
  return (
    <div>
      <label htmlFor={textareaId} className="text-sm font-medium text-[#1d1d1f]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <textarea
        id={textareaId}
        name={textareaId}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="system-input mt-2 w-full resize-none rounded-2xl px-4 py-3 text-sm text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
      />

      {helperText && <p className="mt-2 text-xs text-[#6e6e73]">{helperText}</p>}
    </div>
  );
};

const SummaryRow = ({ label, value, warning = false }) => {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/6 pb-3 last:border-b-0 last:pb-0">
      <span className="text-[#6e6e73]">{label}</span>

      <span
        className={`max-w-45 text-right font-medium ${
          warning ? 'text-red-500' : 'text-[#1d1d1f]'
        }`}
      >
        {value}
      </span>
    </div>
  );
};

export default ManualTicketPage;