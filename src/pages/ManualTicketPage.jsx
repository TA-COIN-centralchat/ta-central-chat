import { useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { createTicketWithAutoAssign } from '../services/ticketService';

const ManualTicketPage = () => {
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    telegram: '',
    email: '',
    accountId: '',
    channel: 'Walk-in',
    issueType: 'Payment Issue',
    subCategory: '',
    transactionId: '',
    issueDescription: '',
    internalNote: '',
  });

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.customerName || !formData.phone || !formData.issueDescription) {
      alert('Please fill Customer Name, Phone Number, and Issue Description.');
      return;
    }

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

      setFormData({
        customerName: '',
        phone: '',
        telegram: '',
        email: '',
        accountId: '',
        channel: 'Walk-in',
        issueType: 'Payment Issue',
        subCategory: '',
        transactionId: '',
        issueDescription: '',
        internalNote: '',
      });
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
      description="Create tickets for walk-in customers, office visits, or phone calls."
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
            The system will automatically assign this ticket to an available agent.
          </p>
        </div>

        {successMessage && (
          <div className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            {successMessage}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Customer Name"
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
              Channel
            </label>
            <select
              value={formData.channel}
              onChange={(e) => handleChange('channel', e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option>Walk-in</option>
              <option>Phone Call</option>
              <option>Office Visit</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Issue Type
            </label>
            <select
              value={formData.issueType}
              onChange={(e) => handleChange('issueType', e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option>Payment Issue</option>
              <option>Withdrawal Issue</option>
              <option>Deposit Issue</option>
              <option>P2P Issue</option>
              <option>Login Issue</option>
              <option>2FA Issue</option>
              <option>KYC Issue</option>
              <option>Account Issue</option>
              <option>Complaint</option>
              <option>Other</option>
            </select>
          </div>

          <Input
            label="Sub-category"
            placeholder="Example: Seller did not release coin"
            value={formData.subCategory}
            onChange={(value) => handleChange('subCategory', value)}
          />

          <Input
            label="Transaction ID"
            placeholder="Optional"
            value={formData.transactionId}
            onChange={(value) => handleChange('transactionId', value)}
          />
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700">
            Issue Description
          </label>
          <textarea
            rows="5"
            value={formData.issueDescription}
            onChange={(e) => handleChange('issueDescription', e.target.value)}
            placeholder="Describe the customer's issue..."
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700">
            Internal Note
          </label>
          <textarea
            rows="3"
            value={formData.internalNote}
            onChange={(e) => handleChange('internalNote', e.target.value)}
            placeholder="Private note for staff only..."
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Creating...' : 'Create Ticket'}
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
};

const Input = ({ label, placeholder, value, onChange }) => (
  <div>
    <label className="text-sm font-medium text-slate-700">{label}</label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
    />
  </div>
);

export default ManualTicketPage;