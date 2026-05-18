import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { createTicketWithAutoAssign } from '../services/ticketService';
import { supabase } from '../services/supabaseClient';

const transactionRequiredKeywords = [
  'payment',
  'withdrawal',
  'deposit',
  'p2p',
  'transaction',
];

const ManualTicketPage = () => {
  const [formData, setFormData] = useState({
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
  });

  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoadingCategories(true);

        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('status', 'Active')
          .order('name', { ascending: true });

        if (error) {
          throw error;
        }

        const activeCategories = data || [];
        setCategories(activeCategories);

        if (activeCategories.length > 0) {
          setFormData((prev) => ({
            ...prev,
            issueType: prev.issueType || activeCategories[0].name,
          }));
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, []);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const isTransactionRequired = transactionRequiredKeywords.some((keyword) =>
    formData.issueType.toLowerCase().includes(keyword)
  );

  const validateForm = () => {
    if (!formData.customerName.trim()) {
      alert('Please enter customer name.');
      return false;
    }

    const hasContact =
      formData.phone.trim() || formData.telegram.trim() || formData.email.trim();

    if (!hasContact) {
      alert(
        'Please enter at least one contact method: phone, Telegram, or email.'
      );
      return false;
    }

    if (!formData.channel) {
      alert('Please select customer contact channel.');
      return false;
    }

    if (!formData.issueType) {
      alert('Please select issue type.');
      return false;
    }

    if (isTransactionRequired && !formData.transactionId.trim()) {
      alert(
        'Transaction ID is required for payment, withdrawal, deposit, or P2P issues.'
      );
      return false;
    }

    if (formData.issueDescription.trim().length < 10) {
      alert('Issue description must be at least 10 characters.');
      return false;
    }

    return true;
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      phone: '',
      telegram: '',
      email: '',
      accountId: '',
      channel: 'Telegram',
      issueType: categories[0]?.name || '',
      subCategory: '',
      transactionId: '',
      issueDescription: '',
      internalNote: '',
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);
      setSuccessMessage('');

      const result = await createTicketWithAutoAssign(formData);

      if (result.assignedAgent) {
        setSuccessMessage(
          `Ticket created and auto-assigned to ${result.assignedAgent.full_name}.`
        );
      } else {
        setSuccessMessage(
          'Ticket created and placed in Waiting Queue because no agent is available.'
        );
      }

      resetForm();
    } catch (error) {
      console.error('Create ticket error:', error);
      alert('Failed to create ticket. Please check console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout
      title="Manual Ticket"
      description="Create tickets manually when an agent identifies a customer issue from Telegram, Website Chatbot, walk-in, phone call, office visit, or other contact channels."
    >
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6"
      >
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-950">
            Create Manual Ticket
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Use this when an agent identifies a real customer issue and needs to
            create a trackable support ticket.
          </p>
        </div>

        {successMessage && (
          <div className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            {successMessage}
          </div>
        )}

        <div className="mb-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
          Required: customer name, at least one contact method, issue type, and
          issue description. Transaction ID is required for payment,
          withdrawal, deposit, or P2P issues.
        </div>

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

          <div>
            <label className="text-sm font-medium text-slate-700">
              Customer Contact Channel <span className="text-red-500">*</span>
            </label>

            <select
              value={formData.channel}
              onChange={(event) => handleChange('channel', event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option>Telegram</option>
              <option>Website Chatbot</option>
              <option>Walk-in</option>
              <option>Phone Call</option>
              <option>Office Visit</option>
              <option>Other</option>
            </select>

            <p className="mt-2 text-xs text-slate-500">
              This means where the customer contacted us first.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Issue Type <span className="text-red-500">*</span>
            </label>

            <select
              value={formData.issueType}
              onChange={(event) => handleChange('issueType', event.target.value)}
              disabled={loadingCategories || categories.length === 0}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
                Please create an active category first before creating tickets.
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
            onChange={(value) => handleChange('transactionId', value)}
          />
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700">
            Issue Description <span className="text-red-500">*</span>
          </label>

          <textarea
            rows="5"
            value={formData.issueDescription}
            onChange={(event) =>
              handleChange('issueDescription', event.target.value)
            }
            placeholder="Describe the customer's issue clearly. Minimum 10 characters."
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />

          <div className="mt-1 text-xs text-slate-400">
            {formData.issueDescription.trim().length}/10 minimum characters
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700">
            Internal Note
          </label>

          <textarea
            rows="3"
            value={formData.internalNote}
            onChange={(event) => handleChange('internalNote', event.target.value)}
            placeholder="Private note for staff only..."
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Clear
          </button>

          <button
            type="submit"
            disabled={loading || loadingCategories || categories.length === 0}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Creating...' : 'Create Ticket'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

const Input = ({ label, placeholder, value, onChange, required = false }) => (
  <div>
    <label className="text-sm font-medium text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>

    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
    />
  </div>
);

export default ManualTicketPage;