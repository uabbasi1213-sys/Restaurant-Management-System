import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Minus, Trash2, ShoppingCart, ImageIcon, Send, X, Receipt, Printer } from 'lucide-react';
import InvoiceModal from '../components/InvoiceModal';

export default function POS() {
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
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [search, setSearch] = useState('');
  const [printOrderId, setPrintOrderId] = useState(null);

  useEffect(() => {
    loadMenu();
  }, []);

  const loadMenu = async () => {
    try {
      const [cats, items] = await Promise.all([
        api.get('/menu/categories'),
        api.get('/menu/items')
      ]);
      setCategories(cats);
      setMenuItems(items.filter(i => i.is_available));
    } catch (err) { toast.error(err.message); }
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

  const placeOrder = async () => {
    if (cart.length === 0) return toast.error('Cart is empty!');
    try {
      const data = await api.post('/orders', {
        order_type: orderType,
        table_number: tableNumber || null,
        items: cart,
        discount: discountAmount,
        tax: taxAmount,
        payment_type: paymentType,
        special_instructions: specialInstructions || null
      });
      setOrderSuccess(data);
      setCart([]);
      setDiscount('');
      setTax('');
      setTableNumber('');
      setSpecialInstructions('');
      setShowCheckout(false);
      toast.success(`Order ${data.order_number} placed!`);
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] -m-6">
      {/* LEFT: Menu Grid */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 p-4">
        {/* Search & Categories */}
        <div className="mb-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search menu..."
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none mb-3"
          />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                !selectedCategory ? 'bg-orange-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'
              }`}
            >All</button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id === selectedCategory ? '' : cat.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  selectedCategory === cat.id ? 'bg-orange-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'
                }`}
              >{cat.name}</button>
            ))}
          </div>
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredItems.map(item => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md hover:scale-[1.02] transition text-left active:scale-95"
              >
                <div className="aspect-[4/3] bg-gray-100 relative">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon size={32} className="text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="font-medium text-gray-800 text-sm truncate">{item.name}</p>
                  <p className="text-orange-600 font-bold">Rs. {item.sale_price}</p>
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

      {/* RIGHT: Cart & Checkout */}
      <div className="w-80 lg:w-96 bg-white border-l flex flex-col">
        {/* Cart Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <ShoppingCart size={18} /> Cart ({cart.length})
            </h3>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-700">
                Clear All
              </button>
            )}
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
            <input
              type="text"
              value={tableNumber}
              onChange={e => setTableNumber(e.target.value)}
              placeholder="Table number..."
              className="w-full mt-2 px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-orange-500 outline-none"
            />
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

            <button
              onClick={placeOrder}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2 active:scale-95"
            >
              <Send size={20} /> Place Order
            </button>
          </div>
        )}
      </div>

      {/* Order Success Popup */}
      {printOrderId && <InvoiceModal orderId={printOrderId} onClose={() => setPrintOrderId(null)} />}

      {orderSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt size={32} className="text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Order Placed!</h3>
            <p className="text-3xl font-bold text-orange-600 mb-1">{orderSuccess.order_number}</p>
            <p className="text-gray-500 mb-4">Total: Rs. {orderSuccess.total?.toFixed(2)}</p>
            <button
              onClick={() => { setPrintOrderId(orderSuccess.id); }}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 mb-2"
            >
              <Printer size={18} /> Print Invoice
            </button>
            <button
              onClick={() => setOrderSuccess(null)}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-semibold transition"
            >
              New Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
