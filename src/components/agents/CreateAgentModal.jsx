import { useState } from 'react';
import { Loader2, UserPlus, X } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/60 dark:border-white/10 bg-white dark:bg-[#1d1d1f] shadow-[0_24px_70px_rgba(15,23,42,0.22)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.4)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#edf1f5] dark:border-white/10 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f7fbfd] dark:bg-[#43acd6]/10 text-[#2389b8] dark:text-[#43acd6] ring-1 ring-[#d8eef7] dark:ring-[#43acd6]/20">
              <UserPlus size={21} />
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#1d1d1f] dark:text-[#f5f5f7]">
                Create Agent
              </h2>

              <p className="mt-1 text-sm leading-6 text-[#6e6e73] dark:text-[#a1a1a6]">
                Add a new support agent account. The default status will be
                Offline until the agent logs in.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-[#8e8e93] dark:text-[#a1a1a6] transition hover:bg-[#f5f5f7] dark:hover:bg-white/10 hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close create agent modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <Input
            label="Full Name"
            required
            placeholder="Example: Agent Dara"
            value={formData.fullName}
            onChange={(value) => handleChange('fullName', value)}
          />

          <Input
            label="Email"
            required
            placeholder="agent@tacoin.com"
            value={formData.email}
            onChange={(value) => handleChange('email', value)}
          />

          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
              Role <span className="text-[#2389b8] dark:text-[#43acd6]">*</span>
            </label>

            <select
              value={formData.role}
              onChange={(event) => handleChange('role', event.target.value)}
              disabled={loading}
              className="system-select system-select--lg mt-2"
            >
              <option>Admin</option>
              <option>Customer Service Agent</option>
              <option>Customer Support Agent</option>
            </select>
          </div>

          <div className="rounded-[22px] border border-[#d8eef7] dark:border-[#43acd6]/30 bg-[#f7fbfd] dark:bg-[#43acd6]/10 p-4 text-sm leading-6 text-[#2389b8] dark:text-[#43acd6]">
            <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Default Status</div>

            <p className="mt-1">
              New agents will be created as{' '}
              <span className="font-semibold">Offline</span>. Later, when login
              is connected, the system will change the status automatically.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-[#edf1f5] dark:border-white/10 bg-[#fbfbfd] dark:bg-[#151515] px-6 py-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-2xl border border-[#e5e7eb] dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm font-medium text-[#6e6e73] dark:text-[#a1a1a6] transition hover:bg-[#f5f5f7] dark:hover:bg-white/10 hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-60 sm:mr-auto"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#43acd6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] dark:shadow-[0_14px_28px_rgba(67,172,214,0.3)] transition hover:-translate-y-0.5 hover:bg-[#2389b8] dark:hover:bg-[#52bce8] hover:shadow-[0_18px_36px_rgba(67,172,214,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <UserPlus size={16} />
                Create Agent
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const Input = ({ label, placeholder, value, onChange, required = false }) => (
  <div>
    <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
      {label} {required && <span className="text-[#2389b8] dark:text-[#43acd6]">*</span>}
    </label>

    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="mt-2 h-12 w-full rounded-[18px] border border-[#e8edf2] dark:border-white/10 bg-[#f8fafc] dark:bg-white/5 px-4 text-sm text-[#1d1d1f] dark:text-[#f5f5f7] outline-none transition placeholder:text-[#8e8e93] dark:placeholder:text-[#a1a1a6] focus:border-[#43acd6] dark:focus:border-[#43acd6] focus:bg-white dark:focus:bg-white/10 focus:ring-4 focus:ring-[#43acd6]/10"
    />
  </div>
);

export default CreateAgentModal;