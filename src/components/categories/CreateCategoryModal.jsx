import { useState } from 'react';
import { FolderPlus, Loader2, X } from 'lucide-react';

import { createCategory } from '../../services/ticketService';

const CreateCategoryModal = ({ open, onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
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
    if (!formData.name.trim()) {
      alert('Please enter category name.');
      return;
    }

    try {
      setLoading(true);

      await createCategory({
        name: formData.name.trim(),
        description: formData.description.trim(),
      });

      setFormData({
        name: '',
        description: '',
      });

      if (onCreated) {
        await onCreated();
      }

      onClose();
    } catch (error) {
      console.error('Create category error:', error);
      alert('Failed to create category. Please check console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#edf1f5] px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f7fbfd] text-[#2389b8] ring-1 ring-[#d8eef7]">
              <FolderPlus size={21} />
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#1d1d1f]">
                Add Category
              </h2>

              <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
                Create a new issue category for customer support tickets.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-[#8e8e93] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close create category modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">
              Category Name <span className="text-[#2389b8]">*</span>
            </label>

            <input
              value={formData.name}
              onChange={(event) => handleChange('name', event.target.value)}
              placeholder="Example: P2P Issue"
              disabled={loading}
              className="mt-2 h-12 w-full rounded-[18px] border border-[#e8edf2] bg-[#f8fafc] px-4 text-sm text-[#1d1d1f] outline-none transition placeholder:text-[#8e8e93] focus:border-[#43acd6] focus:bg-white focus:ring-4 focus:ring-[#43acd6]/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">
              Description
            </label>

            <textarea
              rows="4"
              value={formData.description}
              onChange={(event) =>
                handleChange('description', event.target.value)
              }
              placeholder="Explain when this category should be used..."
              disabled={loading}
              className="mt-2 w-full resize-none rounded-[22px] border border-[#e8edf2] bg-[#f8fafc] px-4 py-3 text-sm leading-6 text-[#1d1d1f] outline-none transition placeholder:text-[#8e8e93] focus:border-[#43acd6] focus:bg-white focus:ring-4 focus:ring-[#43acd6]/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="rounded-[22px] border border-[#d8eef7] bg-[#f7fbfd] p-4 text-sm leading-6 text-[#2389b8]">
            <div className="font-semibold text-[#1d1d1f]">Default Status</div>

            <p className="mt-1">
              New categories will be created as{' '}
              <span className="font-semibold">Active</span>.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse justify-end gap-3 border-t border-[#edf1f5] bg-[#fbfbfd] px-6 py-4 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6e6e73] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#43acd6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(67,172,214,0.18)] transition hover:-translate-y-0.5 hover:bg-[#2389b8] hover:shadow-[0_18px_36px_rgba(67,172,214,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <FolderPlus size={16} />
                Create Category
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateCategoryModal;