import { useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Printer, X, Download } from 'lucide-react';

export default function InvoiceModal({ orderId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    if (orderId) {
      api.get(`/invoice/${orderId}`).then(d => { setData(d); setLoading(false); }).catch(err => { toast.error(err.message); onClose(); });
    }
  }, [orderId]);

  const handlePrint = () => {
    const printContent = document.getElementById('invoice-print-area');
    const win = window.open('', '_blank', 'width=320,height=600');
    win.document.write(`
      <html><head><title>Invoice</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; padding: 10px; width: 280px; color: #000; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; padding: 1px 0; }
        .items td { padding: 2px 0; }
        .big { font-size: 16px; }
        .sm { font-size: 10px; }
        table { width: 100%; border-collapse: collapse; }
        @media print { body { width: 72mm; padding: 2mm; } }
      </style></head><body>
      ${printContent.innerHTML}
      <script>window.onload=function(){window.print();window.close();}<\/script>
      </body></html>
    `);
    win.document.close();
  };

  if (loading || !data) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div></div>
    </div>
  );

  const { restaurant, order } = data;
  const items = order.items || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-800">Invoice</h3>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition">
              <Printer size={16} /> Print
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2"><X size={20} /></button>
          </div>
        </div>

        {/* Invoice Preview */}
        <div className="flex-1 overflow-y-auto p-4">
          <div id="invoice-print-area" className="font-mono text-xs bg-white" style={{ maxWidth: '280px', margin: '0 auto' }}>
            {/* Restaurant Info */}
            <div className="center bold big" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', marginBottom: '2px' }}>
              {restaurant.name}
            </div>
            {restaurant.address && <div style={{ textAlign: 'center', fontSize: '10px' }}>{restaurant.address}</div>}
            {restaurant.phone && <div style={{ textAlign: 'center', fontSize: '10px' }}>Tel: {restaurant.phone}</div>}

            <div className="line" style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>

            {/* Order Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
              <span style={{ fontWeight: 'bold' }}>{order.order_number}</span>
              <span>{new Date(order.created_at).toLocaleDateString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
              <span style={{ textTransform: 'capitalize' }}>{order.order_type}{order.table_number ? ` - Table ${order.table_number}` : ''}</span>
              <span>{new Date(order.created_at).toLocaleTimeString()}</span>
            </div>
            {order.cashier_name && <div style={{ fontSize: '10px' }}>Cashier: {order.cashier_name}</div>}
            {order.customer_name && <div style={{ fontSize: '10px' }}>Customer: {order.customer_name} {order.customer_phone ? `(${order.customer_phone})` : ''}</div>}

            <div className="line" style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>

            {/* Items */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <th style={{ textAlign: 'left', padding: '2px 0', fontSize: '10px' }}>Item</th>
                  <th style={{ textAlign: 'center', padding: '2px 0', fontSize: '10px' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '2px 0', fontSize: '10px' }}>Price</th>
                  <th style={{ textAlign: 'right', padding: '2px 0', fontSize: '10px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: '2px 0', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.item_name}</td>
                    <td style={{ textAlign: 'center', padding: '2px 0' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right', padding: '2px 0' }}>{item.price?.toFixed(0)}</td>
                    <td style={{ textAlign: 'right', padding: '2px 0' }}>{item.total?.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="line" style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
              <span>Subtotal:</span>
              <span>Rs. {order.subtotal?.toFixed(2)}</span>
            </div>
            {order.tax > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                <span>Tax:</span>
                <span>Rs. {order.tax?.toFixed(2)}</span>
              </div>
            )}
            {order.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                <span>Discount:</span>
                <span>-Rs. {order.discount?.toFixed(2)}</span>
              </div>
            )}

            <div className="line" style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontWeight: 'bold', fontSize: '14px' }}>
              <span>TOTAL:</span>
              <span>Rs. {order.total?.toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0', fontSize: '10px' }}>
              <span>Payment:</span>
              <span style={{ textTransform: 'uppercase' }}>{order.payment_type}</span>
            </div>

            {order.special_instructions && (
              <>
                <div className="line" style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>
                <div style={{ fontSize: '10px' }}>Note: {order.special_instructions}</div>
              </>
            )}

            <div className="line" style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>

            <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '4px' }}>
              Thank you for visiting!
            </div>
            <div style={{ textAlign: 'center', fontSize: '9px', color: '#666', marginTop: '2px' }}>
              Powered by Restaurant MS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
