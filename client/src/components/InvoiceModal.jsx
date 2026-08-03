import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Printer, X, Settings } from 'lucide-react';

export default function InvoiceModal({ orderId, onClose }) {
  const { tenant } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  // Thermal paper width: '58mm' or '80mm'
  const [paperWidth, setPaperWidth] = useState(
    localStorage.getItem('thermalPaperWidth') || '80mm'
  );

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', orderId)
          .single();
        if (error) throw error;
        setOrder(data);
      } catch (err) {
        toast.error('Could not load invoice: ' + err.message);
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const handlePaperChange = (w) => {
    setPaperWidth(w);
    localStorage.setItem('thermalPaperWidth', w);
  };

  const handlePrint = () => {
    const printContent = document.getElementById('invoice-print-area');
    if (!printContent) return;

    // Paper widths: 58mm → content 50mm, 80mm → content 72mm
    const is58 = paperWidth === '58mm';
    const contentWidth = is58 ? '50mm' : '72mm';
    const baseFontSize = is58 ? '13px' : '15px';
    const headFontSize = is58 ? '16px' : '19px';
    const subFontSize  = is58 ? '11px' : '13px';
    const totalFontSize = is58 ? '15px' : '18px';

    const win = window.open('', '_blank', `width=400,height=700`);
    win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt</title>
  <style>
    /* ── THERMAL PRINTER RECEIPT CSS ── */
    @page {
      size: ${paperWidth} auto;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: ${contentWidth};
      font-family: 'Courier New', Courier, monospace;
      font-size: ${baseFontSize};
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt {
      width: ${contentWidth};
      padding: 4mm 2mm;
    }
    .center  { text-align: center; }
    .right   { text-align: right; }
    .bold    { font-weight: bold; }
    .rest-name {
      font-size: ${headFontSize};
      font-weight: bold;
      text-align: center;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    .rest-info {
      font-size: ${subFontSize};
      text-align: center;
      color: #333;
    }
    .divider {
      border: none;
      border-top: 1px dashed #000;
      margin: 4px 0;
    }
    .divider-solid {
      border: none;
      border-top: 1px solid #000;
      margin: 4px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 1px 0;
      font-size: ${baseFontSize};
    }
    .row-sm {
      display: flex;
      justify-content: space-between;
      padding: 1px 0;
      font-size: ${subFontSize};
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
    }
    .items-table th {
      font-size: ${subFontSize};
      text-align: left;
      padding: 2px 1px;
      border-bottom: 1px solid #000;
    }
    .items-table th.right { text-align: right; }
    .items-table th.center { text-align: center; }
    .items-table td {
      font-size: ${baseFontSize};
      padding: 2px 1px;
      vertical-align: top;
    }
    .items-table td.right  { text-align: right; }
    .items-table td.center { text-align: center; }
    .item-name {
      max-width: ${is58 ? '90px' : '120px'};
      word-break: break-word;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: ${totalFontSize};
      font-weight: bold;
      padding: 3px 0;
    }
    .footer {
      text-align: center;
      font-size: ${subFontSize};
      margin-top: 4px;
    }
    .powered {
      text-align: center;
      font-size: ${is58 ? '9px' : '11px'};
      color: #555;
      margin-top: 2px;
    }
    @media print {
      html, body { width: ${contentWidth}; }
      .receipt   { padding: 2mm 1mm; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    ${printContent.innerHTML}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); window.close(); }, 300);
    };
  </script>
</body>
</html>
    `);
    win.document.close();
  };

  if (loading || !order) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    </div>
  );

  const items = order.order_items || [];
  const restaurant = tenant || {};

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-800">Receipt / Invoice</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition"
            >
              <Printer size={16} /> Print
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Thermal Paper Width Selector */}
        <div className="flex items-center gap-3 px-4 py-2 bg-orange-50 border-b text-sm">
          <Settings size={14} className="text-orange-600" />
          <span className="text-gray-600 font-medium">Thermal Paper:</span>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio" name="paper" value="80mm"
              checked={paperWidth === '80mm'}
              onChange={() => handlePaperChange('80mm')}
              className="accent-orange-600"
            />
            <span className="font-semibold">80mm</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio" name="paper" value="58mm"
              checked={paperWidth === '58mm'}
              onChange={() => handlePaperChange('58mm')}
              className="accent-orange-600"
            />
            <span className="font-semibold">58mm</span>
          </label>
        </div>

        {/* Receipt Preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div
            id="invoice-print-area"
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: '14px',
              background: '#fff',
              width: '280px',
              margin: '0 auto',
              padding: '8px',
              border: '1px dashed #ccc'
            }}
          >
            {/* Restaurant Name */}
            <div style={{ fontSize: '18px', fontWeight: 'bold', textAlign: 'center', letterSpacing: '1px', marginBottom: '2px' }}>
              {restaurant.name || 'Restaurant'}
            </div>
            {restaurant.address && (
              <div className="rest-info" style={{ fontSize: '12px', textAlign: 'center' }}>{restaurant.address}</div>
            )}
            {restaurant.phone && (
              <div style={{ fontSize: '12px', textAlign: 'center' }}>Tel: {restaurant.phone}</div>
            )}

            <hr style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Order Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '1px 0' }}>
              <span style={{ fontWeight: 'bold' }}>{order.order_number}</span>
              <span>{new Date(order.created_at).toLocaleDateString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '1px 0' }}>
              <span style={{ textTransform: 'capitalize' }}>
                {order.order_type}{order.table_number ? ` - Table ${order.table_number}` : ''}
              </span>
              <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {order.customer_name && (
              <div style={{ fontSize: '12px', padding: '1px 0' }}>Customer: {order.customer_name}</div>
            )}

            <hr style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left',   fontSize: '12px', padding: '2px 1px', borderBottom: '1px solid #000' }}>Item</th>
                  <th style={{ textAlign: 'center', fontSize: '12px', padding: '2px 1px', borderBottom: '1px solid #000' }}>Qty</th>
                  <th style={{ textAlign: 'right',  fontSize: '12px', padding: '2px 1px', borderBottom: '1px solid #000' }}>Rate</th>
                  <th style={{ textAlign: 'right',  fontSize: '12px', padding: '2px 1px', borderBottom: '1px solid #000' }}>Amt</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: '3px 1px', fontSize: '13px', maxWidth: '110px', wordBreak: 'break-word' }}>
                      {item.item_name}
                    </td>
                    <td style={{ textAlign: 'center', padding: '3px 1px', fontSize: '13px' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right',  padding: '3px 1px', fontSize: '13px' }}>
                      {Number(item.price || 0).toFixed(0)}
                    </td>
                    <td style={{ textAlign: 'right',  padding: '3px 1px', fontSize: '13px', fontWeight: 'bold' }}>
                      {Number(item.total || (item.price * item.quantity) || 0).toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <hr style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Totals */}
            {order.subtotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '1px 0' }}>
                <span>Subtotal:</span>
                <span>Rs. {Number(order.subtotal || 0).toFixed(0)}</span>
              </div>
            )}
            {order.tax > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '1px 0' }}>
                <span>Tax:</span>
                <span>Rs. {Number(order.tax || 0).toFixed(0)}</span>
              </div>
            )}
            {order.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '1px 0' }}>
                <span>Discount:</span>
                <span>-Rs. {Number(order.discount || 0).toFixed(0)}</span>
              </div>
            )}

            <hr style={{ borderTop: '1px solid #000', margin: '6px 0' }} />

            {/* Grand Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: 'bold', padding: '3px 0' }}>
              <span>TOTAL:</span>
              <span>Rs. {Number(order.total || 0).toFixed(0)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '1px 0' }}>
              <span>Payment:</span>
              <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
                {order.payment_type || order.payment_method || 'Cash'}
              </span>
            </div>

            {order.special_instructions && (
              <>
                <hr style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                <div style={{ fontSize: '12px' }}>Note: {order.special_instructions}</div>
              </>
            )}

            <hr style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            <div style={{ textAlign: 'center', fontSize: '13px', marginTop: '4px', fontWeight: 'bold' }}>
              Thank you! Please visit again.
            </div>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#666', marginTop: '2px' }}>
              Powered by Restaurant MS
            </div>
            {/* Extra space at bottom for paper cut */}
            <div style={{ height: '12px' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
