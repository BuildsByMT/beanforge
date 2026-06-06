const { query } = require('./db');
const { verifyToken } = require('./authHelper');

module.exports = async function handler(req, res) {
  try {
    const user = verifyToken(req);
    let userId = user ? user.userId : null;

    // Fallback for user_id based on method
    if (!userId) {
      if (req.method === 'GET' || req.method === 'DELETE') {
        userId = req.query.user_id ? parseInt(req.query.user_id, 10) : null;
      } else {
        userId = req.body.user_id ? parseInt(req.body.user_id, 10) : null;
      }
    }

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Authentication required or user_id must be provided' });
    }

    // 1. GET: Retrieve cart items joined with product metadata
    if (req.method === 'GET') {
      const cartItems = await query(
        `SELECT c.cart_id, c.product_id, c.quantity, p.name, p.price, p.image_url, p.type, p.category, p.roast_level, p.origin 
         FROM cart c 
         JOIN products p ON c.product_id = p.product_id 
         WHERE c.user_id = ?`,
        [userId]
      );
      return res.status(200).json(cartItems);
    }

    // 2. POST: Add item to cart or increment quantity
    if (req.method === 'POST') {
      const { product_id, quantity } = req.body;
      const qty = quantity ? parseInt(quantity, 10) : 1;

      if (!product_id) {
        return res.status(400).json({ success: false, message: 'Product ID is required' });
      }

      // Check product availability
      const products = await query('SELECT is_available FROM products WHERE product_id = ?', [product_id]);
      if (products.length === 0 || !products[0].is_available) {
        return res.status(400).json({ success: false, message: 'Product is unavailable or does not exist' });
      }

      // Check if item is already in user's cart
      const existing = await query('SELECT cart_id, quantity FROM cart WHERE user_id = ? AND product_id = ?', [userId, product_id]);

      if (existing.length > 0) {
        const newQty = existing[0].quantity + qty;
        await query('UPDATE cart SET quantity = ? WHERE cart_id = ?', [newQty, existing[0].cart_id]);
        return res.status(200).json({ success: true, message: 'Cart item quantity updated' });
      } else {
        await query('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)', [userId, product_id, qty]);
        return res.status(200).json({ success: true, message: 'Product added to cart' });
      }
    }

    // 3. PUT: Update specific cart item quantity
    if (req.method === 'PUT') {
      const { product_id, quantity } = req.body;

      if (!product_id || quantity === undefined) {
        return res.status(400).json({ success: false, message: 'Product ID and quantity are required' });
      }

      const qty = parseInt(quantity, 10);
      if (qty <= 0) {
        await query('DELETE FROM cart WHERE user_id = ? AND product_id = ?', [userId, product_id]);
        return res.status(200).json({ success: true, message: 'Product removed from cart' });
      } else {
        await query('UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?', [qty, userId, product_id]);
        return res.status(200).json({ success: true, message: 'Cart item quantity updated' });
      }
    }

    // 4. DELETE: Remove single item or clear entire cart
    if (req.method === 'DELETE') {
      const { product_id, clear_all } = req.query;

      if (clear_all === 'true') {
        await query('DELETE FROM cart WHERE user_id = ?', [userId]);
        return res.status(200).json({ success: true, message: 'Cart cleared successfully' });
      }

      if (!product_id) {
        return res.status(400).json({ success: false, message: 'Product ID or clear_all=true is required' });
      }

      await query('DELETE FROM cart WHERE user_id = ? AND product_id = ?', [userId, product_id]);
      return res.status(200).json({ success: true, message: 'Product removed from cart' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  } catch (error) {
    console.error('Cart API error:', error);
    return res.status(500).json({ success: false, message: 'Failed to perform cart action', error: error.message });
  }
};
