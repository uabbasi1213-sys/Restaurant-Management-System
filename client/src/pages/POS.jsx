import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Plus, Minus, Trash2, ShoppingCart, ImageIcon, Send, X, Receipt, Printer, Eye,
  UtensilsCrossed, Settings, RefreshCw, CheckCircle2, Maximize2, Minimize2, ChevronDown, ChevronUp
} from 'lucide-react';
import InvoiceModal from '../components/InvoiceModal';
import { printInvoice } from '../utils/printInvoice';

export default function POS() {
  const { profile, tenant } = useAuth();
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('dine-in');
  const [tableNumber, setTableNumber] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [search, setSearch] = useState('');
  const [printOrderId, setPrintOrderId] = useState(null);
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem('pos_auto_print') === 'true');
  const [expandCategories, setExpandCategories] = useState(false);
  const [isFullView, setIsFullView] = useState(false);

  // Table Management & Running Order State
  const [activeOrders, setActiveOrders] = useState([]);
  const [activeTableOrder, setActiveTableOrder] = useState(null);
  const [tablesList, setTablesList] = useState(() => {
    try {
      const saved = localStorage.getItem('restaurant_tables');
      if (saved) return JSON.parse(saved);
    } catch {}
    return Array.from({ length: 12 }, (_, i) => `Table ${i + 1}`);
  });
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableCountInput, setTableCountInput] = useState(12);
  const [customTableName, setCustomTableName] = useState('');

  useEffect(() => {
    if (profile) {
      loadMenu();
      loadActiveOrders();
    }
  }, [profile?.id]);

  const loadMenu = async () => {
    try {
      const cats = await api.get('/menu-categories');
      const items = await api.get('/menu-items?available=true');
      setCategories(Array.isArray(cats) ? cats : cats.categories || []);
      setMenuItems(Array.isArray(items) ? items : items.items || []);
    } catch (err) {
      toast.error('Failed to load menu: ' + err.message);
    }
  };

  const filteredItems = menuItems.filter(item => {
    const matchCat = selectedCategory ? item.category_id === selectedCategory : true;
    const matchSearch = search ? item.name.toLowerCase().includes(search.toLowerCase()) : true;
    return matchCat && matchSearch;
  });

  const addToCart = (item) => {
    const existing = cart.find(c => c.menu_item_id === item.id);
    if (existing) {
      setCart(cart.map(c => c.menu_item_id === item.id
        ? { ...c, quantity: c.quantity + 1, total: (c.quantity + 1) * c.price }
        : c
      ));
    } else {
      setCart([...cart, {
        menu_item_id: item.id,
        item_name: item.name,
        price: item.sale_price,
        quantity: 1,
        total: item.sale_price,
        special_instructions: '',
        image: item.image
      }]);
    }
  };

  const updateQuantity = (menuItemId, delta) => {
    setCart(cart.map(c => {
      if (c.menu_item_id === menuItemId) {
        const newQty = c.quantity + delta;
        if (newQty <= 0) return null;
        return { ...c, quantity: newQty, total: newQty * c.price };
      }
      return c;
    }).filter(Boolean));
  };

  const removeFromCart = (menuItemId) => {
    setCart(cart.filter(c => c.menu_item_id !== menuItemId));
  };

  const updateItemInstructions = (menuItemId, instructions) => {
    setCart(cart.map(c => c.menu_item_id === menuItemId ? { ...c, special_instructions: instructions } : c));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = parseFloat(tax) || 0;
  const discountAmount = parseFloat(discount) || 0;
  const grandTotal = subtotal + taxAmount - discountAmount;

  const loadActiveOrders = async () => {
    try {
      const allOrders = await api.get('/orders');
      const active = (allOrders || []).filter(o => 
        o.order_type === 'dine-in' &&
        ['pending', 'preparing', 'ready'].includes(o.status) &&
        o.table_number
      );
      setActiveOrders(active);
    } catch (err) {
      console.warn('Failed to load active orders for tables:', err);
    }
  };

  const handleSelectTable = (tbl) => {
    setTableNumber(tbl);
    const existing = activeOrders.find(o => o.table_number === tbl);
    if (existing) {
      setActiveTableOrder(existing);
      if (existing.items && existing.items.length > 0) {
        setCart(existing.items.map(it => ({
          menu_item_id: it.menu_item_id,
          item_name: it.item_name || it.name,
          price: Number(it.price) || 0,
          quantity: Number(it.quantity) || 1,
          total: Number(it.total) || ((Number(it.price) || 0) * (Number(it.quantity) || 1)),
          special_instructions: it.special_instructions || '',
          image: it.image
        })));
      }
      setDiscount(existing.discount ? String(existing.discount) : '');
      setTax(existing.tax ? String(existing.tax) : '');
      setPaymentType(existing.payment_type || 'cash');
      setSpecialInstructions(existing.special_instructions || '');
      toast(`Loaded running order for ${tbl}`, { icon: '🍽️' });
    } else {
      setActiveTableOrder(null);
      if (activeTableOrder) {
        setCart([]);
        setDiscount('');
        setTax('');
        setSpecialInstructions('');
      }
    }
  };

  const startFreshOrderOnTable = () => {
    setActiveTableOrder(null);
    setCart([]);
    setDiscount('');
    setTax('');
    setSpecialInstructions('');
    toast.success(`Started new order for ${tableNumber || 'table'}`);
  };

  const updateTableOrder = async () => {
    if (!activeTableOrder) return;
    if (cart.length === 0) return toast.error('Cart is empty!');
    try {
      const updated = await api.put(`/orders/${activeTableOrder.id}`, {
        order_type: 'dine-in',
        table_number: tableNumber,
        total: grandTotal,
        subtotal: subtotal,
        discount: discountAmount,
        tax: taxAmount,
        payment_type: paymentType,
        special_instructions: specialInstructions || null,
        status: activeTableOrder.status || 'preparing',
        items: cart.map(item => ({
          menu_item_id: item.menu_item_id,
          item_name: item.item_name,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          special_instructions: item.special_instructions || null
        }))
      });

      toast.success(`Table ${tableNumber} updated with new items!`);
      await loadActiveOrders();
      if (autoPrint) {
        setTimeout(() => printInvoice(updated, tenant), 150);
      }
    } catch (err) {
      toast.error('Failed to update table order: ' + err.message);
    }
  };

  const settleTableBill = async () => {
    if (!activeTableOrder) return;
    try {
      const completed = await api.put(`/orders/${activeTableOrder.id}`, {
        order_type: 'dine-in',
        table_number: tableNumber,
        total: grandTotal,
        subtotal: subtotal,
        discount: discountAmount,
        tax: taxAmount,
        payment_type: paymentType,
        status: 'completed',
        items: cart.map(item => ({
          menu_item_id: item.menu_item_id,
          item_name: item.item_name,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          special_instructions: item.special_instructions || null
        }))
      });

      toast.success(`Table ${tableNumber} bill settled! Table is now free.`);
      setTimeout(() => printInvoice(completed, tenant), 150);
      setCart([]);
      setDiscount('');
      setTax('');
      setTableNumber('');
      setSpecialInstructions('');
      setActiveTableOrder(null);
      await loadActiveOrders();
    } catch (err) {
      toast.error('Failed to settle bill: ' + err.message);
    }
  };

  const saveTableCount = (count) => {
    const num = Math.max(1, Math.min(100, parseInt(count) || 10));
    const newTables = Array.from({ length: num }, (_, i) => `Table ${i + 1}`);
    setTablesList(newTables);
    try {
      localStorage.setItem('restaurant_tables', JSON.stringify(newTables));
    } catch {}
    setShowTableModal(false);
    toast.success(`${num} tables configured!`);
  };

  const addCustomTable = () => {
    const trimmed = customTableName.trim();
    if (!trimmed) return;
    if (tablesList.includes(trimmed)) return toast.error('Table already exists');
    const updated = [...tablesList, trimmed];
    setTablesList(updated);
    try {
      localStorage.setItem('restaurant_tables', JSON.stringify(updated));
    } catch {}
    setCustomTableName('');
    toast.success(`Added ${trimmed}!`);
  };

  const removeTable = (tbl) => {
    const updated = tablesList.filter(t => t !== tbl);
    setTablesList(updated);
    try {
      localStorage.setItem('restaurant_tables', JSON.stringify(updated));
    } catch {}
    if (tableNumber === tbl) setTableNumber('');
  };

  const placeOrder = async () => {
    if (cart.length === 0) return toast.error('Cart is empty!');
    try {
      const orderData = await api.post('/orders', {
        order_type: orderType,
        table_number: tableNumber || null,
        total: grandTotal,
        subtotal: subtotal,
        discount: discountAmount,
        tax: taxAmount,
        payment_type: paymentType,
        special_instructions: specialInstructions || null,
        status: 'preparing',
        items: cart.map(item => ({
          menu_item_id: item.menu_item_id,
          item_name: item.item_name,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          special_instructions: item.special_instructions || null
        }))
      });

      setOrderSuccess(orderData);
      setCart([]);
      setDiscount('');
      setTax('');
      setTableNumber('');
      setSpecialInstructions('');
      setActiveTableOrder(null);
      toast.success(`Order ${orderData.order_number} placed!`);
      loadActiveOrders();

      if (autoPrint) {
        setTimeout(() => printInvoice(orderData, tenant), 150);
      }
    } catch (err) { toast.error(err.message); }
  };

  // Mobile cart visibility state
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Cart content - reused in both desktop sidebar and mobile bottom sheet
  const CartContent = ({ isMobile = false }) => (
    <>
      {/* Cart Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <ShoppingCart size={18} /> Cart ({cart.length})
          </h3>
          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-700">
                Clear All
              </button>
            )}
            {isMobile && (
              <button onClick={() => setMobileCartOpen(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100">
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Order Type */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {['dine-in', 'takeaway', 'delivery'].map(type => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition capitalize ${
                orderType === type ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >{type}</button>
          ))}
        </div>

        {orderType === 'dine-in' && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700 flex items-center gap-1">
                <UtensilsCrossed size={12} className="text-orange-600" /> Table Selection
              </span>
              <button
                type="button"
                onClick={() => { setTableCountInput(tablesList.length); setShowTableModal(true); }}
                className="text-[11px] text-orange-600 hover:text-orange-800 font-medium flex items-center gap-0.5"
              >
                <Settings size={11} /> Manage ({tablesList.length})
              </button>
            </div>

            <div className="flex gap-1.5">
              <select
                value={tableNumber}
                onChange={e => handleSelectTable(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold focus:ring-2 focus:ring-orange-500 outline-none bg-white"
              >
                <option value="">-- Choose Table --</option>
                {tablesList.map(t => {
                  const running = activeOrders.find(o => o.table_number === t);
                  return (
                    <option key={t} value={t}>
                      {t} {running ? `• Occupied (Rs. ${running.total})` : '• Free'}
                    </option>
                  );
                })}
              </select>
              <input
                type="text"
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                placeholder="Or type..."
                className="w-20 px-2 py-1.5 rounded-lg border text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                title="Custom Table Name"
              />
            </div>

            {activeTableOrder && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-xs">
                <div className="flex items-center justify-between font-bold text-orange-800">
                  <span>🍽️ Active: {activeTableOrder.order_number}</span>
                  <span className="bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold">
                    {activeTableOrder.status}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] text-gray-600">
                  <span>Running Total: <strong>Rs. {Number(activeTableOrder.total || 0).toFixed(0)}</strong></span>
                  <button
                    type="button"
                    onClick={startFreshOrderOnTable}
                    className="text-red-600 hover:underline font-medium text-[10px]"
                  >
                    Start Fresh
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ShoppingCart size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Add items from menu</p>
          </div>
        ) : (
          cart.map(item => (
            <div key={item.menu_item_id} className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-start gap-2">
                {item.image && (
                  <img src={item.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">{item.item_name}</p>
                  <p className="text-orange-600 text-xs font-semibold">Rs. {item.price} each</p>
                </div>
                <button onClick={() => removeFromCart(item.menu_item_id)} className="text-red-400 hover:text-red-600 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2 bg-white rounded-lg border">
                  <button onClick={() => updateQuantity(item.menu_item_id, -1)} className="p-1.5 hover:bg-gray-100 rounded-l-lg">
                    <Minus size={14} />
                  </button>
                  <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.menu_item_id, 1)} className="p-1.5 hover:bg-gray-100 rounded-r-lg">
                    <Plus size={14} />
                  </button>
                </div>
                <p className="font-bold text-gray-800 text-sm">Rs. {item.total.toFixed(2)}</p>
              </div>
              <input
                type="text"
                value={item.special_instructions}
                onChange={e => updateItemInstructions(item.menu_item_id, e.target.value)}
                placeholder="Special instructions..."
                className="w-full mt-2 px-2 py-1 rounded-md border text-xs focus:ring-1 focus:ring-orange-500 outline-none"
              />
            </div>
          ))
        )}
      </div>

      {/* Cart Footer */}
      {cart.length > 0 && (
        <div className="border-t p-4 space-y-3">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span className="font-semibold">Rs. {subtotal.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number" min="0" step="0.01"
              value={discount}
              onChange={e => setDiscount(e.target.value)}
              placeholder="Discount"
              className="px-2 py-1.5 rounded-lg border text-sm focus:ring-1 focus:ring-orange-500 outline-none"
            />
            <input
              type="number" min="0" step="0.01"
              value={tax}
              onChange={e => setTax(e.target.value)}
              placeholder="Tax"
              className="px-2 py-1.5 rounded-lg border text-sm focus:ring-1 focus:ring-orange-500 outline-none"
            />
          </div>

          <div className="flex justify-between text-lg font-bold text-gray-800 pt-2 border-t">
            <span>Total</span>
            <span className="text-orange-600">Rs. {grandTotal.toFixed(2)}</span>
          </div>

          {/* Payment Type */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {['cash', 'card', 'online', 'credit'].map(type => (
              <button
                key={type}
                onClick={() => setPaymentType(type)}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition capitalize ${
                  paymentType === type ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
                }`}
              >{type}</button>
            ))}
          </div>

          {/* Auto Print Toggle */}
          <div className="flex items-center justify-between text-xs text-gray-600 px-1 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={e => {
                  setAutoPrint(e.target.checked);
                  localStorage.setItem('pos_auto_print', e.target.checked ? 'true' : 'false');
                }}
                className="w-4 h-4 text-orange-600 rounded accent-orange-600"
              />
              <span className="font-medium text-gray-700 flex items-center gap-1.5">
                <Printer size={13} className="text-gray-500" /> Auto-print invoice on place order
              </span>
            </label>
          </div>

          {activeTableOrder ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => { updateTableOrder(); if (isMobile) setMobileCartOpen(false); }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 active:scale-95 shadow-sm"
              >
                <RefreshCw size={16} /> Update Table ({activeTableOrder.order_number})
              </button>
              <button
                type="button"
                onClick={() => { settleTableBill(); if (isMobile) setMobileCartOpen(false); }}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-base transition flex items-center justify-center gap-2 active:scale-95 shadow-sm"
              >
                <CheckCircle2 size={18} /> Settle Bill & Free Table
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { placeOrder(); if (isMobile) setMobileCartOpen(false); }}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2 active:scale-95"
            >
              <Send size={20} /> Place Order
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-[calc(100vh-5rem)] -m-4 md:-m-6">
      {/* LEFT: Menu Grid - full width on mobile */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 p-3 md:p-4">
        {/* Search & Header Controls */}
        <div className="mb-2">
          <div className="flex gap-2 items-center mb-1.5">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search menu..."
              className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs md:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white shadow-xs"
            />
            {/* Toggle Category Wrap Button */}
            <button
              type="button"
              onClick={() => setExpandCategories(!expandCategories)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 text-xs font-medium flex items-center gap-1 shadow-xs transition-all"
              title={expandCategories ? 'Collapse categories' : 'Expand all categories'}
            >
              <span>Categories</span>
              {expandCategories ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {/* Full Screen / Focus Items Toggle */}
            <button
              type="button"
              onClick={() => setIsFullView(!isFullView)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-all ${
                isFullView
                  ? 'bg-orange-600 text-white border border-orange-600'
                  : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
              }`}
              title={isFullView ? 'Normal View' : 'Bari Screen (Expand Items)'}
            >
              {isFullView ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span className="hidden sm:inline">{isFullView ? 'Normal' : 'Bari Screen'}</span>
            </button>
          </div>

          {/* Categories Bar: Sleek 1-line horizontal scroll by default */}
          {(!isFullView || expandCategories) && (
            <div className={`flex gap-1.5 items-center pb-1 ${
              expandCategories
                ? 'flex-wrap max-h-48 overflow-y-auto'
                : 'overflow-x-auto scrollbar-thin'
            }`}>
              <button
                onClick={() => setSelectedCategory('')}
                className={`flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  !selectedCategory ? 'bg-orange-600 text-white shadow-xs' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >All</button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id === selectedCategory ? '' : cat.id)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                    selectedCategory === cat.id ? 'bg-orange-600 text-white shadow-xs' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >{cat.name}</button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Tables Bar (Dine-In) - Sleek & compact, hidden in full-view */}
        {!isFullView && orderType === 'dine-in' && (
          <div className="mb-2 bg-white p-2 rounded-lg border border-gray-200 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
                <UtensilsCrossed size={12} className="text-orange-600" /> Tables
                <span className="text-[10px] font-normal text-gray-500">
                  ({activeOrders.length} occupied / {tablesList.length} total)
                </span>
              </span>
              <button
                type="button"
                onClick={() => { setTableCountInput(tablesList.length); setShowTableModal(true); }}
                className="text-[11px] text-orange-600 hover:text-orange-800 font-semibold flex items-center gap-0.5 hover:underline"
              >
                <Settings size={11} /> Manage Tables
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
              {tablesList.map(t => {
                const running = activeOrders.find(o => o.table_number === t);
                const isSelected = tableNumber === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleSelectTable(t)}
                    className={`flex-shrink-0 px-2 py-1 rounded-md border text-xs transition-all flex flex-col items-center min-w-[62px] ${
                      isSelected
                        ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                        : running
                        ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <span className="font-bold text-[11px]">{t}</span>
                    <span className={`text-[9px] ${isSelected ? 'text-orange-100' : running ? 'text-amber-700 font-bold' : 'text-gray-400'}`}>
                      {running ? `Rs. ${Number(running.total || 0).toFixed(0)}` : 'Free'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-2.5">
            {filteredItems.map(item => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden hover:shadow-md hover:scale-[1.01] transition text-left active:scale-95"
              >
                <div className="aspect-[16/10] bg-gray-100 relative">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon size={22} className="text-gray-300 md:w-6 md:h-6" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="font-medium text-gray-800 text-xs md:text-sm truncate">{item.name}</p>
                  <p className="text-orange-600 font-bold text-xs md:text-sm">Rs. {item.sale_price}</p>
                </div>
              </button>
            ))}
            {filteredItems.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400">
                No items available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Cart Sidebar - DESKTOP ONLY (hidden on mobile) */}
      <div className="hidden md:flex w-80 lg:w-96 bg-white border-l flex-col">
        <CartContent isMobile={false} />
      </div>

      {/* MOBILE: Floating Cart Button (shown only on mobile when cart has items) */}
      {cart.length > 0 && !mobileCartOpen && (
        <button
          onClick={() => setMobileCartOpen(true)}
          className="md:hidden fixed bottom-5 right-5 z-40 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl px-5 py-3.5 shadow-xl shadow-orange-600/30 flex items-center gap-3 active:scale-95 transition-all"
        >
          <div className="relative">
            <ShoppingCart size={22} />
            <span className="absolute -top-2 -right-2 bg-white text-orange-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
              {totalCartItems}
            </span>
          </div>
          <div className="text-left">
            <p className="text-xs font-medium opacity-90">{cart.length} item{cart.length > 1 ? 's' : ''}</p>
            <p className="text-sm font-bold">Rs. {grandTotal.toFixed(0)}</p>
          </div>
        </button>
      )}

      {/* MOBILE: Cart Bottom Sheet Overlay */}
      {mobileCartOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Dark backdrop */}
          <div
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={() => setMobileCartOpen(false)}
          />
          {/* Bottom Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl flex flex-col shadow-2xl"
            style={{ maxHeight: '90vh' }}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <CartContent isMobile={true} />
          </div>
        </div>
      )}

      {/* Order Success Popup */}
      {printOrderId && <InvoiceModal orderId={printOrderId} onClose={() => setPrintOrderId(null)} />}

      {orderSuccess && !printOrderId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt size={32} className="text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Order Placed!</h3>
            <p className="text-3xl font-bold text-orange-600 mb-1">{orderSuccess.order_number}</p>
            <p className="text-gray-500 mb-4">Total: Rs. {orderSuccess.total?.toFixed(2)}</p>
            <button
              onClick={() => {
                printInvoice(orderSuccess, tenant);
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 mb-2 active:scale-95 shadow-sm shadow-green-600/30"
            >
              <Printer size={18} /> Print Invoice
            </button>
            <button
              onClick={() => setOrderSuccess(null)}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-semibold transition mb-3 active:scale-95"
            >
              New Order
            </button>
            <button
              onClick={() => setPrintOrderId(orderSuccess.id)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1 mx-auto"
            >
              <Eye size={13} /> Preview receipt modal
            </button>
          </div>
        </div>
      )}

      {/* Table Management Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <UtensilsCrossed className="text-orange-600" size={20} />
                Manage Restaurant Tables
              </h3>
              <button
                type="button"
                onClick={() => setShowTableModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Set Count */}
            <div className="mb-4 bg-orange-50 border border-orange-100 rounded-xl p-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Quick Setup Table Count (e.g. 10 or 20 tables)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={tableCountInput}
                  onChange={e => setTableCountInput(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                  placeholder="e.g. 10"
                />
                <button
                  type="button"
                  onClick={saveTableCount}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition"
                >
                  Set Tables
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Generates T-1, T-2, ... up to the chosen count.
              </p>
            </div>

            {/* Add Custom Named Table */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Or Add Custom Table / Area (e.g. Roof-1, VIP-2, Hall-A)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customTableName}
                  onChange={e => setCustomTableName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTable(); } }}
                  placeholder="e.g. VIP-1"
                  className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  type="button"
                  onClick={addCustomTable}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-gray-900 transition"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Current Tables List */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-700">Active Tables ({tablesList.length})</span>
                <span className="text-[11px] text-gray-400">Click × to remove</span>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-xl p-2.5 flex flex-wrap gap-1.5 bg-gray-50">
                {tablesList.map(t => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 bg-white border border-gray-300 text-gray-800 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-sm"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTable(t)}
                      className="text-gray-400 hover:text-red-600 font-bold ml-0.5"
                      title="Delete Table"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowTableModal(false)}
                className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-sm transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
