import { useState } from 'react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-950">
          Add Category
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Create a new issue category for customer support tickets.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Category Name
            </label>
            <input
              value={formData.name}
              onChange={(event) => handleChange('name', event.target.value)}
              placeholder="Example: P2P Issue"
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              rows="4"
              value={formData.description}
              onChange={(event) =>
                handleChange('description', event.target.value)
              }
              placeholder="Explain when this category should be used..."
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <div className="font-medium text-slate-900">Default Status</div>
            <p className="mt-1">
              New categories will be created as <strong>Active</strong>.
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
            {loading ? 'Creating...' : 'Create Category'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateCategoryModal;