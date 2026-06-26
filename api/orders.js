const { query } = require('./db');
const { verifyToken } = require('./authHelper');

module.exports = async function handler(req, res) {
  try {
    const user = verifyToken(req);
    const userId = user ? user.userId : null;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
    }

    // 1. GET: Retrieve user's orders with items
    if (req.method === 'GET') {
      const orderRows = await query(
        `SELECT o.order_id, o.total_price, o.status, o.order_type, o.created_at,
                oi.item_id, oi.product_id, oi.quantity, oi.price AS item_price,
                p.name AS product_name, p.image_url, p.category
         FROM orders o
         LEFT JOIN order_items oi ON o.order_id = oi.order_id
         LEFT JOIN products p ON oi.product_id = p.product_id
         WHERE o.user_id = ?
         ORDER BY o.created_at DESC`,
        [userId]
      );

      // Group rows by order_id
      const ordersMap = {};
      for (const row of orderRows) {
        if (!ordersMap[row.order_id]) {
          ordersMap[row.order_id] = {
            order_id: row.order_id,
            total_price: row.total_price,
            status: row.status,
            order_type: row.order_type,
            created_at: row.created_at,
            items: []
          };
        }

        if (row.item_id) {
          ordersMap[row.order_id].items.push({
            item_id: row.item_id,
            product_id: row.product_id,
            product_name: row.product_name,
            image_url: row.image_url,
            category: row.category,
            quantity: row.quantity,
            price: row.item_price
          });
        }
      }

      const ordersList = Object.values(ordersMap);
      return res.status(200).json(ordersList);
    }

    // 2. POST: Checkout cart and place a new order
    if (req.method === 'POST') {
      // Get all cart items for the user
      const cartItems = await query(
        `SELECT c.product_id, c.quantity, p.price, p.type 
         FROM cart c 
         JOIN products p ON c.product_id = p.product_id 
         WHERE c.user_id = ?`,
        [userId]
      );

      if (cartItems.length === 0) {
        return res.status(400).json({ success: false, message: 'Your cart is empty' });
      }

      // Calculate total price and determine order type (bean or drink)
      let totalPrice = 0;
      let hasBeans = false;
      let hasDrinks = false;

      for (const item of cartItems) {
        totalPrice += Number(item.price) * item.quantity;
        if (item.type === 'bean') {
          hasBeans = true;
        } else {
          hasDrinks = true;
        }
      }

      // If there are both beans and drinks, order_type defaults to 'drink' or 'bean'
      // Let's decide based on whether beans are present, since beans are bulk and might need special handling
      const orderType = hasBeans ? 'bean' : 'drink';

      // Insert Order Header
      const orderResult = await query(
        'INSERT INTO orders (user_id, total_price, status, order_type) VALUES (?, ?, ?, ?)',
        [userId, totalPrice, 'pending', orderType]
      );

      const orderId = orderResult.insertId;

      // Insert Order Items
      for (const item of cartItems) {
        await query(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [orderId, item.product_id, item.quantity, item.price]
        );
      }

      // Clear Cart
      await query('DELETE FROM cart WHERE user_id = ?', [userId]);

      return res.status(201).json({ // Using standard 201 Created (was 251 in original)
        success: true,
        message: 'Order placed successfully',
        order_id: orderId,
        total_price: totalPrice,
        order_type: orderType
      });
    }

    // 3. DELETE: Cancel/delete user's own order
    if (req.method === 'DELETE') {
      const orderId = req.query.order_id ? parseInt(req.query.order_id, 10) : null;
      if (!orderId) {
        return res.status(400).json({ success: false, message: 'Order ID is required' });
      }

      // Check order ownership and status
      const checkOrder = await query('SELECT user_id, status FROM orders WHERE order_id = ?', [orderId]);
      if (checkOrder.length === 0) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      if (checkOrder[0].user_id !== userId) {
        return res.status(403).json({ success: false, message: 'Forbidden: You do not own this order' });
      }

      const status = checkOrder[0].status;
      if (status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel order because it is already in "${status}" status.`
        });
      }

      await query('DELETE FROM orders WHERE order_id = ? AND user_id = ?', [orderId, userId]);
      return res.status(200).json({ success: true, message: 'Order cancelled and deleted successfully' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  } catch (error) {
    console.error('Orders API error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process order action', error: error.message });
  }
};
