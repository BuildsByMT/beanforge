const { query } = require('./db');
const { verifyToken } = require('./authHelper');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  try {
    const user = verifyToken(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }

    // 1. Fetch Stats counts
    const userCountResult = await query('SELECT COUNT(*) AS count FROM users');
    const orderCountResult = await query('SELECT COUNT(*) AS count FROM orders');
    const productCountResult = await query('SELECT COUNT(*) AS count FROM products');

    const stats = {
      users: userCountResult && userCountResult[0] ? userCountResult[0].count : 0,
      orders: orderCountResult && orderCountResult[0] ? orderCountResult[0].count : 0,
      products: productCountResult && productCountResult[0] ? productCountResult[0].count : 0
    };

    // 2. Fetch Users List
    const users = await query('SELECT user_id, username, email, role, created_at FROM users ORDER BY created_at DESC');

    // 3. Fetch Orders List (Global) with explicit GROUP BY list for SQL compatibility
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
  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve admin details', error: error.message });
  }
};
