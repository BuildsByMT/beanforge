const { query } = require('./db');
const { verifyToken } = require('./authHelper');

module.exports = async function handler(req, res) {
  try {
    const user = verifyToken(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }

    // 1. GET: Fetch admin dashboard statistics and list data
    if (req.method === 'GET') {
      const userCountResult = await query('SELECT COUNT(*) AS count FROM users');
      const orderCountResult = await query('SELECT COUNT(*) AS count FROM orders');
      const productCountResult = await query('SELECT COUNT(*) AS count FROM products');
      const bookingCountResult = await query('SELECT COUNT(*) AS count FROM bookings');

      const stats = {
        users: userCountResult && userCountResult[0] ? userCountResult[0].count : 0,
        orders: orderCountResult && orderCountResult[0] ? orderCountResult[0].count : 0,
        products: productCountResult && productCountResult[0] ? productCountResult[0].count : 0,
        bookings: bookingCountResult && bookingCountResult[0] ? bookingCountResult[0].count : 0
      };

      const users = await query('SELECT user_id, username, email, role, created_at FROM users ORDER BY created_at DESC');

      const orders = await query(
        `SELECT o.order_id, o.user_id, u.username AS user_name, u.email AS user_email,
                o.total_price, o.status, o.order_type, o.created_at,
                GROUP_CONCAT(CONCAT(p.name, ' (x', oi.quantity, ')') SEPARATOR ', ') AS items_summary
         FROM orders o
         JOIN users u ON o.user_id = u.user_id
         LEFT JOIN order_items oi ON o.order_id = oi.order_id
         LEFT JOIN products p ON oi.product_id = p.product_id
         GROUP BY o.order_id, o.user_id, u.username, u.email, o.total_price, o.status, o.order_type, o.created_at
         ORDER BY o.created_at DESC`
      );

      const quotes = await query(
        `SELECT q.quote_id, q.user_id, u.username AS user_name, u.email AS user_email,
                q.product_id, p.name AS product_name, q.quantity_lbs, q.notes, q.status, q.created_at,
                p.price AS base_price
         FROM quotes q
         JOIN users u ON q.user_id = u.user_id
         JOIN products p ON q.product_id = p.product_id
         ORDER BY q.created_at DESC`
      );

      const bookingsRows = await query(
        `SELECT b.booking_id, b.user_id, u.username AS user_name, u.email AS user_email,
                b.reservation_name, b.booking_date, b.booking_time, b.table_number, b.status, b.order_id, b.created_at,
                o.total_price,
                GROUP_CONCAT(CONCAT(p.name, ' (x', oi.quantity, ')') SEPARATOR ', ') AS pre_orders_summary
         FROM bookings b
         JOIN users u ON b.user_id = u.user_id
         LEFT JOIN orders o ON b.order_id = o.order_id
         LEFT JOIN order_items oi ON o.order_id = oi.order_id
         LEFT JOIN products p ON oi.product_id = p.product_id
         GROUP BY b.booking_id, b.user_id, u.username, u.email, b.reservation_name, b.booking_date, b.booking_time, b.table_number, b.status, b.order_id, b.created_at, o.total_price
         ORDER BY b.booking_date DESC, b.booking_time DESC`
      );

      return res.status(200).json({
        success: true,
        stats,
        users,
        orders,
        quotes,
        bookings: bookingsRows
      });
    }

    // 2. PUT: Edit an order, quote, or booking status/details
    if (req.method === 'PUT') {
      const { order_id, quote_id, booking_id, status, total_price, order_type, quantity_lbs, table_number } = req.body;

      if (quote_id) {
        await query(
          `UPDATE quotes 
           SET status = COALESCE(?, status), 
               quantity_lbs = COALESCE(?, quantity_lbs) 
           WHERE quote_id = ?`,
          [status || null, quantity_lbs !== undefined ? parseInt(quantity_lbs, 10) : null, parseInt(quote_id, 10)]
        );
        return res.status(200).json({ success: true, message: 'Quote updated successfully' });
      }

      if (booking_id) {
        await query(
          `UPDATE bookings 
           SET status = COALESCE(?, status), 
               table_number = COALESCE(?, table_number) 
           WHERE booking_id = ?`,
          [status || null, table_number !== undefined ? parseInt(table_number, 10) : null, parseInt(booking_id, 10)]
        );

        // Auto-update linked pre-order status if applicable
        const checkBooking = await query('SELECT order_id FROM bookings WHERE booking_id = ?', [booking_id]);
        if (checkBooking.length > 0 && checkBooking[0].order_id) {
          const linkedOrderId = checkBooking[0].order_id;
          let newOrderStatus = null;
          if (status === 'confirmed') newOrderStatus = 'approved';
          else if (status === 'cancelled') newOrderStatus = 'cancelled';
          else if (status === 'completed') newOrderStatus = 'completed';
          else if (status === 'preparing') newOrderStatus = 'preparing';

          if (newOrderStatus) {
            await query('UPDATE orders SET status = ? WHERE order_id = ?', [newOrderStatus, linkedOrderId]);
          }
        }
        return res.status(200).json({ success: true, message: 'Booking updated successfully' });
      }

      if (!order_id) {
        return res.status(400).json({ success: false, message: 'Order ID, Quote ID, or Booking ID is required' });
      }

      await query(
        `UPDATE orders 
         SET status = COALESCE(?, status), 
             total_price = COALESCE(?, total_price), 
             order_type = COALESCE(?, order_type) 
         WHERE order_id = ?`,
        [status || null, total_price !== undefined ? parseFloat(total_price) : null, order_type || null, parseInt(order_id, 10)]
      );

      return res.status(200).json({ success: true, message: 'Order updated successfully' });
    }

    // 3. DELETE: Permanently delete an order, quote, or booking
    if (req.method === 'DELETE') {
      const orderId = req.query.order_id ? parseInt(req.query.order_id, 10) : null;
      const quoteId = req.query.quote_id ? parseInt(req.query.quote_id, 10) : null;
      const bookingId = req.query.booking_id ? parseInt(req.query.booking_id, 10) : null;

      if (quoteId) {
        await query('DELETE FROM quotes WHERE quote_id = ?', [quoteId]);
        return res.status(200).json({ success: true, message: 'Quote deleted successfully' });
      }

      if (bookingId) {
        const checkBooking = await query('SELECT order_id FROM bookings WHERE booking_id = ?', [bookingId]);
        if (checkBooking.length > 0 && checkBooking[0].order_id) {
          await query('DELETE FROM orders WHERE order_id = ?', [checkBooking[0].order_id]);
        }
        await query('DELETE FROM bookings WHERE booking_id = ?', [bookingId]);
        return res.status(200).json({ success: true, message: 'Booking deleted successfully' });
      }

      if (!orderId) {
        return res.status(400).json({ success: false, message: 'Order ID, Quote ID, or Booking ID is required' });
      }

      await query('DELETE FROM orders WHERE order_id = ?', [orderId]);
      return res.status(200).json({ success: true, message: 'Order deleted successfully' });
    }

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process admin action', error: error.message });
  }
};
