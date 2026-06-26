const { query } = require('./db');
const { verifyToken } = require('./authHelper');

module.exports = async function handler(req, res) {
  try {
    const user = verifyToken(req);
    const userId = user ? user.userId : null;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
    }

    // 1. GET: Fetch bookings or check table availability
    if (req.method === 'GET') {
      const checkDate = req.query.date;
      const checkTime = req.query.time;

      // Case A: Query booked tables for a specific date and time slot
      if (checkDate && checkTime) {
        const bookedRows = await query(
          `SELECT table_number FROM bookings 
           WHERE booking_date = ? AND booking_time = ? AND status != 'cancelled' AND status != 'completed'`,
          [checkDate, checkTime]
        );
        const bookedTables = bookedRows.map(row => row.table_number);
        return res.status(200).json(bookedTables);
      }

      // Case B: Fetch history of bookings for current user
      const bookingRows = await query(
        `SELECT b.booking_id, b.reservation_name, b.booking_date, b.booking_time, b.table_number, b.status, b.order_id, b.created_at,
                o.total_price, o.status AS order_status,
                oi.item_id, oi.product_id, oi.quantity, p.name AS product_name
         FROM bookings b
         LEFT JOIN orders o ON b.order_id = o.order_id
         LEFT JOIN order_items oi ON o.order_id = oi.order_id
         LEFT JOIN products p ON oi.product_id = p.product_id
         WHERE b.user_id = ?
         ORDER BY b.booking_date DESC, b.booking_time DESC`,
        [userId]
      );

      // Group rows by booking_id
      const bookingsMap = {};
      for (const row of bookingRows) {
        if (!bookingsMap[row.booking_id]) {
          bookingsMap[row.booking_id] = {
            booking_id: row.booking_id,
            reservation_name: row.reservation_name,
            booking_date: row.booking_date,
            booking_time: row.booking_time,
            table_number: row.table_number,
            status: row.status,
            order_id: row.order_id,
            created_at: row.created_at,
            total_price: row.total_price || null,
            order_status: row.order_status || null,
            items: []
          };
        }

        if (row.item_id && row.product_id) {
          bookingsMap[row.booking_id].items.push({
            item_id: row.item_id,
            product_id: row.product_id,
            product_name: row.product_name,
            quantity: row.quantity
          });
        }
      }

      const bookingsList = Object.values(bookingsMap);
      return res.status(200).json(bookingsList);
    }

    // 2. POST: Create a new table booking (with optional pre-order)
    if (req.method === 'POST') {
      const { reservation_name, booking_date, booking_time, table_number, pre_order } = req.body;

      if (!reservation_name || !booking_date || !booking_time || !table_number) {
        return res.status(400).json({ success: false, message: 'All booking fields are required.' });
      }

      const tableNum = parseInt(table_number, 10);

      // Double-check availability for this slot
      const existing = await query(
        `SELECT booking_id FROM bookings 
         WHERE booking_date = ? AND booking_time = ? AND table_number = ? AND status != 'cancelled' AND status != 'completed'`,
        [booking_date, booking_time, tableNum]
      );

      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'This table has already been booked for the selected date and time.' });
      }

      let orderId = null;

      // Handle Pre-ordering checkout if selected
      if (pre_order) {
        const cartItems = await query(
          `SELECT c.product_id, c.quantity, p.price, p.type 
           FROM cart c 
           JOIN products p ON c.product_id = p.product_id 
           WHERE c.user_id = ?`,
          [userId]
        );

        if (cartItems.length === 0) {
          return res.status(400).json({ success: false, message: 'Your cart is empty. Cannot pre-order items.' });
        }

        let totalPrice = 0;
        let hasBeans = false;
        for (const item of cartItems) {
          totalPrice += Number(item.price) * item.quantity;
          if (item.type === 'bean') hasBeans = true;
        }

        const orderType = hasBeans ? 'bean' : 'drink';

        // Insert Order Header
        const orderResult = await query(
          `INSERT INTO orders (user_id, total_price, status, order_type) VALUES (?, ?, ?, ?)`,
          [userId, totalPrice, 'pending', orderType]
        );
        orderId = orderResult.insertId;

        // Insert Order Items
        for (const item of cartItems) {
          await query(
            `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)`,
            [orderId, item.product_id, item.quantity, item.price]
          );
        }

        // Clear user cart
        await query(`DELETE FROM cart WHERE user_id = ?`, [userId]);
      }

      // Insert Table Booking
      const bookingResult = await query(
        `INSERT INTO bookings (user_id, reservation_name, booking_date, booking_time, table_number, status, order_id) 
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        [userId, reservation_name, booking_date, booking_time, tableNum, orderId]
      );

      return res.status(201).json({
        success: true,
        message: 'Table booking reserved successfully!',
        booking_id: bookingResult.insertId,
        order_id: orderId
      });
    }

    // 3. DELETE: Cancel/delete booking
    if (req.method === 'DELETE') {
      const bookingId = req.query.booking_id ? parseInt(req.query.booking_id, 10) : null;
      if (!bookingId) {
        return res.status(400).json({ success: false, message: 'Booking ID is required' });
      }

      const checkBooking = await query('SELECT user_id, status, order_id FROM bookings WHERE booking_id = ?', [bookingId]);
      if (checkBooking.length === 0) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      if (checkBooking[0].user_id !== userId) {
        return res.status(403).json({ success: false, message: 'Forbidden: You do not own this booking' });
      }

      if (checkBooking[0].status !== 'pending') {
        return res.status(400).json({ success: false, message: `Cannot cancel booking because it is already "${checkBooking[0].status}".` });
      }

      // If there's a pre-order linked and it is still pending, cancel/delete the order too
      const linkedOrderId = checkBooking[0].order_id;
      if (linkedOrderId) {
        const checkOrder = await query('SELECT status FROM orders WHERE order_id = ?', [linkedOrderId]);
        if (checkOrder.length > 0 && checkOrder[0].status === 'pending') {
          await query('DELETE FROM orders WHERE order_id = ?', [linkedOrderId]);
        }
      }

      await query('DELETE FROM bookings WHERE booking_id = ? AND user_id = ?', [bookingId, userId]);
      return res.status(200).json({ success: true, message: 'Booking cancelled and deleted successfully.' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  } catch (error) {
    console.error('Bookings API error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process booking action', error: error.message });
  }
};
