import { useState } from 'react';
import { createAgent } from '../../services/ticketService';

const CreateAgentModal = ({ open, onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: 'Customer Service Agent',
  });

  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.fullName || !formData.email) {
      alert('Please enter full name and email.');
      return;
    }

    try {
      setLoading(true);

      await createAgent(formData);

      setFormData({
        fullName: '',
        email: '',
        role: 'Customer Service Agent',
      });

      if (onCreated) {
        onCreated();
      }

      onClose();
    } catch (error) {
      console.error('Create agent error:', error);
      alert('Failed to create agent. Email may already exist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-950">
          Create Agent
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Add a new support agent account. The default status will be Offline until the agent logs in.
        </p>

        <div className="mt-5 space-y-4">
          <Input
            label="Full Name"
            placeholder="Example: Agent Dara"
            value={formData.fullName}
            onChange={(value) => handleChange('fullName', value)}
          />

          <Input
            label="Email"
            placeholder="agent@tacoin.com"
            value={formData.email}
            onChange={(value) => handleChange('email', value)}
          />

          <div>
            <label className="text-sm font-medium text-slate-700">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(event) => handleChange('role', event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option>Admin</option>
              <option>Customer Service Agent</option>
              <option>Customer Support Agent</option>
            </select>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <div className="font-medium text-slate-900">Default Status</div>
            <p className="mt-1">
              New agents will be created as <strong>Offline</strong>. Later, when login is connected, the system will change the status automatically.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Creating...' : 'Create Agent'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Input = ({ label, placeholder, value, onChange }) => (
  <div>
    <label className="text-sm font-medium text-slate-700">{label}</label>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
    />
  </div>
);

export default CreateAgentModal;