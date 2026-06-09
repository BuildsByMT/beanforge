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

      const stats = {
        users: userCountResult && userCountResult[0] ? userCountResult[0].count : 0,
        orders: orderCountResult && orderCountResult[0] ? orderCountResult[0].count : 0,
        products: productCountResult && productCountResult[0] ? productCountResult[0].count : 0
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

      return res.status(200).json({
        success: true,
        stats,
        users,
        orders
      });
    }

    // 2. PUT: Edit an order (status, total_price, type)
    if (req.method === 'PUT') {
      const { order_id, status, total_price, order_type } = req.body;
      if (!order_id) {
        return res.status(400).json({ success: false, message: 'Order ID is required' });
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

    // 3. DELETE: Permanently delete an order
    if (req.method === 'DELETE') {
      const orderId = req.query.order_id ? parseInt(req.query.order_id, 10) : null;
      if (!orderId) {
        return res.status(400).json({ success: false, message: 'Order ID is required' });
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
