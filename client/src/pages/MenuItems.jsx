import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, Search, ImageIcon, ToggleLeft, ToggleRight } from 'lucide-react';

export default function MenuItems() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [form, setForm] = useState({
    name: '', category_id: '', cost_price: '', sale_price: '', description: '', barcode: ''
  });

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadItems();
  }, [selectedCategory, search]);

  const loadCategories = async () => {
    try {
      const data = await api.get('/menu/categories');
      setCategories(data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const loadItems = async () => {
    try {
      let url = '/menu/items?';
      if (selectedCategory) url += `category_id=${selectedCategory}&`;
      if (search) url += `search=${encodeURIComponent(search)}`;
      const data = await api.get(url);
      setItems(data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', category_id: categories[0]?.id || '', cost_price: '', sale_price: '', description: '', barcode: '' });
    setImagePreview('');
    setImageFile(null);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name,
      category_id: item.category_id || '',
      cost_price: item.cost_price || '',
      sale_price: item.sale_price,
      description: item.description || '',
      barcode: item.barcode || ''
    });
    setImagePreview(item.image || '');
    setImageFile(null);
    setShowModal(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('category_id', form.category_id);
      formData.append('cost_price', form.cost_price);
      formData.append('sale_price', form.sale_price);
      formData.append('description', form.description);
      formData.append('barcode', form.barcode);
      if (imageFile) formData.append('image', imageFile);

      if (editing) {
        await api.put(`/menu/items/${editing.id}`, formData);
        toast.success('Menu item updated');
      } else {
        await api.post('/menu/items', formData);
        toast.success('Menu item created');
      }
      setShowModal(false);
      loadItems();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleAvailability = async (item) => {
    try {
      await api.patch(`/menu/items/${item.id}/availability`, {});
      loadItems();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.delete(`/menu/items/${item.id}`);
      toast.success('Item deleted');
      loadItems();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Menu Items</h1>
          <p className="text-gray-500 text-sm">{items.length} items</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-medium transition">
          <Plus size={18} /> Add Item
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search menu items..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                !selectedCategory ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id === selectedCategory ? '' : cat.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  selectedCategory === cat.id ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map(item => (
          <div key={item.id} className={`bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition ${!item.is_available ? 'opacity-60' : ''}`}>
            {/* Image */}
            <div className="relative aspect-[4/3] bg-gray-100">
              {item.image ? (
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={48} className="text-gray-300" />
                </div>
              )}
              {/* Availability Badge */}
              <div className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-bold ${
                item.is_available ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
              }`}>
                {item.is_available ? 'Available' : 'Unavailable'}
              </div>
              {/* Category Badge */}
              {item.category_name && (
                <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded-lg text-xs">
                  {item.category_name}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-800 text-lg">{item.name}</h3>
              {item.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
              )}
              <div className="flex items-center justify-between mt-3">
                <div>
                  <p className="text-xl font-bold text-orange-600">Rs. {item.sale_price}</p>
                  {item.cost_price > 0 && (
                    <p className="text-xs text-gray-400">Cost: Rs. {item.cost_price}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleAvailability(item)}
                    className={`p-1.5 rounded-lg transition ${item.is_available ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
                    title={item.is_available ? 'Disable' : 'Enable'}
                  >
                    {item.is_available ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  </button>
                  <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(item)} className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="col-span-full text-center py-16 bg-white rounded-xl shadow-sm">
            <ImageIcon size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 mb-2">No menu items found</p>
            <button onClick={openAdd} className="text-orange-600 hover:text-orange-700 font-medium text-sm">
              + Add your first item
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl my-8">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-semibold">{editing ? 'Edit Menu Item' : 'Add Menu Item'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Item Image</label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={28} className="text-gray-400" />
                    )}
                  </div>
                  <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition">
                    Choose Image
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="e.g., Chicken Biryani"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={form.category_id}
                  onChange={e => setForm({...form, category_id: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                >
                  <option value="">No Category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.cost_price}
                    onChange={e => setForm({...form, cost_price: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price (Rs.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.sale_price}
                    onChange={e => setForm({...form, sale_price: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  rows={2}
                  placeholder="Brief description of the item"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barcode (Optional)</label>
                <input
                  type="text"
                  value={form.barcode}
                  onChange={e => setForm({...form, barcode: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="Barcode number"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-medium">
                  {editing ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
