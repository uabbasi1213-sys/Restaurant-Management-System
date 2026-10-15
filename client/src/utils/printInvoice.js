export function printInvoice(order, restaurant = {}, paperWidth) {
  if (!order) return;

  const width = paperWidth || localStorage.getItem('thermalPaperWidth') || '80mm';
  const is58 = width === '58mm';
  const contentWidth = is58 ? '50mm' : '72mm';
  const baseFontSize = is58 ? '13px' : '15px';
  const headFontSize = is58 ? '16px' : '19px';
  const subFontSize  = is58 ? '11px' : '13px';
  const totalFontSize = is58 ? '15px' : '18px';

  const items = order.items || order.order_items || [];
  const orderDate = new Date(order.created_at || Date.now());
  const dateStr = orderDate.toLocaleDateString();
  const timeStr = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 3px 1px; font-size: ${baseFontSize}; max-width: ${is58 ? '90px' : '120px'}; word-break: break-word;">
        ${item.item_name || item.name || 'Item'}
      </td>
      <td style="text-align: center; padding: 3px 1px; font-size: ${baseFontSize};">${item.quantity || 1}</td>
      <td style="text-align: right; padding: 3px 1px; font-size: ${baseFontSize};">
        ${Number(item.price || 0).toFixed(0)}
      </td>
      <td style="text-align: right; padding: 3px 1px; font-size: ${baseFontSize}; font-weight: bold;">
        ${Number(item.total || (item.price * (item.quantity || 1)) || 0).toFixed(0)}
      </td>
    </tr>
  `).join('');

  const win = window.open('', '_blank', 'width=400,height=700');
  if (!win) {
    alert('Please allow popups for direct invoice printing');
    return;
  }

  win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${order.order_number || 'Order'}</title>
  <style>
    @page {
      size: ${width} auto;
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
      margin: 0 auto;
    }
    @media print {
      html, body { width: ${contentWidth}; }
      .receipt { padding: 2mm 1mm; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Restaurant Header -->
    <div style="font-size: ${headFontSize}; font-weight: bold; text-align: center; letter-spacing: 1px; margin-bottom: 2px;">
      ${restaurant.name || 'Restaurant'}
    </div>
    ${restaurant.address ? `<div style="font-size: ${subFontSize}; text-align: center; color: #333;">${restaurant.address}</div>` : ''}
    ${restaurant.phone ? `<div style="font-size: ${subFontSize}; text-align: center; color: #333;">Tel: ${restaurant.phone}</div>` : ''}

    <hr style="border: none; border-top: 1px dashed #000; margin: 6px 0;" />

    <!-- Order Info -->
    <div style="display: flex; justify-content: space-between; font-size: ${baseFontSize}; padding: 1px 0;">
      <span style="font-weight: bold;">${order.order_number || 'ORD'}</span>
      <span>${dateStr}</span>
    </div>
    <div style="display: flex; justify-content: space-between; font-size: ${baseFontSize}; padding: 1px 0;">
      <span style="text-transform: capitalize;">
        ${order.order_type || 'dine-in'}${order.table_number ? ` - Table ${order.table_number}` : ''}
      </span>
      <span>${timeStr}</span>
    </div>
    ${order.customer_name ? `<div style="font-size: ${subFontSize}; padding: 1px 0;">Customer: ${order.customer_name}</div>` : ''}

    <hr style="border: none; border-top: 1px dashed #000; margin: 6px 0;" />

    <!-- Items Table -->
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="text-align: left; font-size: ${subFontSize}; padding: 2px 1px; border-bottom: 1px solid #000;">Item</th>
          <th style="text-align: center; font-size: ${subFontSize}; padding: 2px 1px; border-bottom: 1px solid #000;">Qty</th>
          <th style="text-align: right; font-size: ${subFontSize}; padding: 2px 1px; border-bottom: 1px solid #000;">Rate</th>
          <th style="text-align: right; font-size: ${subFontSize}; padding: 2px 1px; border-bottom: 1px solid #000;">Amt</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <hr style="border: none; border-top: 1px dashed #000; margin: 6px 0;" />

    <!-- Totals -->
    ${Number(order.subtotal) > 0 ? `
      <div style="display: flex; justify-content: space-between; font-size: ${baseFontSize}; padding: 1px 0;">
        <span>Subtotal:</span>
        <span>Rs. ${Number(order.subtotal).toFixed(0)}</span>
      </div>
    ` : ''}
    ${Number(order.tax) > 0 ? `
      <div style="display: flex; justify-content: space-between; font-size: ${baseFontSize}; padding: 1px 0;">
        <span>Tax:</span>
        <span>Rs. ${Number(order.tax).toFixed(0)}</span>
      </div>
    ` : ''}
    ${Number(order.discount) > 0 ? `
      <div style="display: flex; justify-content: space-between; font-size: ${baseFontSize}; padding: 1px 0;">
        <span>Discount:</span>
        <span>-Rs. ${Number(order.discount).toFixed(0)}</span>
      </div>
    ` : ''}

    <hr style="border: none; border-top: 1px solid #000; margin: 6px 0;" />

    <!-- Grand Total -->
    <div style="display: flex; justify-content: space-between; font-size: ${totalFontSize}; font-weight: bold; padding: 3px 0;">
      <span>TOTAL:</span>
      <span>Rs. ${Number(order.total || 0).toFixed(0)}</span>
    </div>

    <div style="display: flex; justify-content: space-between; font-size: ${baseFontSize}; padding: 1px 0;">
      <span>Payment:</span>
      <span style="text-transform: uppercase; font-weight: bold;">
        ${order.payment_type || order.payment_method || 'Cash'}
      </span>
    </div>

    ${order.special_instructions ? `
      <hr style="border: none; border-top: 1px dashed #000; margin: 6px 0;" />
      <div style="font-size: ${subFontSize};">Note: ${order.special_instructions}</div>
    ` : ''}

    <hr style="border: none; border-top: 1px dashed #000; margin: 6px 0;" />
    <div style="text-align: center; font-size: ${baseFontSize}; margin-top: 4px; font-weight: bold;">
      Thank you! Please visit again.
    </div>
    <div style="text-align: center; font-size: ${subFontSize}; color: #666; margin-top: 2px;">
      Powered by Restaurant MS
    </div>
    <div style="height: 12px;"></div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.close();
      }, 300);
    };
  </script>
</body>
</html>
  `);
  win.document.close();
}

export default printInvoice;
