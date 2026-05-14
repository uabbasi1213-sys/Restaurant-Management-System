import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, FolderOpen, UtensilsCrossed } from 'lucide-react';

export default function MenuCategories() {
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    try {
      const data = await api.get('/menu/categories');
      setCategories(data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setName('');
    setShowModal(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setName(cat.name);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/menu/categories/${editing.id}`, { name });
        toast.success('Category updated');
      } else {
        await api.post('/menu/categories', { name });
        toast.success('Category created');
      }
      setShowModal(false);
      loadCategories();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (cat) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await api.delete(`/menu/categories/${cat.id}`);
      toast.success('Category deleted');
      loadCategories();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Menu Categories</h1>
          <p className="text-gray-500 text-sm">{categories.length} categories</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-medium transition">
          <Plus size={18} /> Add Category
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.map(cat => (
          <div key={cat.id} className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <FolderOpen size={24} className="text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{cat.name}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <UtensilsCrossed size={12} /> {cat.item_count} items
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(cat)} className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50">
                  <Pencil size={15} />
                </button>
                <button onClick={() => handleDelete(cat)} className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {categories.length === 0 && (
          <div className="col-span-full text-center py-16 bg-white rounded-xl shadow-sm">
            <FolderOpen size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">No categories yet. Add your first category!</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-semibold">{editing ? 'Edit Category' : 'Add Category'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-lg"
                  placeholder="e.g., Biryani, Karahi, BBQ"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-medium">
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
