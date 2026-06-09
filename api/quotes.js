const { query } = require('./db');
const { verifyToken } = require('./authHelper');

module.exports = async function handler(req, res) {
  try {
    const user = verifyToken(req);
    let userId = user ? user.userId : null;

    if (!userId) {
      if (req.method === 'GET') {
        userId = req.query.user_id ? parseInt(req.query.user_id, 10) : null;
      } else {
        userId = req.body.user_id ? parseInt(req.body.user_id, 10) : null;
      }
    }

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Authentication required or user_id must be provided' });
    }

    // 1. GET: Retrieve quotes requested by the user
    if (req.method === 'GET') {
      const quotes = await query(
        `SELECT q.quote_id, q.product_id, q.quantity_lbs, q.notes, q.status, q.created_at,
                p.name AS product_name, p.origin, p.roast_level, p.price AS base_price, p.image_url
         FROM quotes q
         JOIN products p ON q.product_id = p.product_id
         WHERE q.user_id = ?
         ORDER BY q.created_at DESC`,
        [userId]
      );
      return res.status(200).json(quotes);
    }

    // 2. POST: Create a new quote request
    if (req.method === 'POST') {
      const { product_id, quantity_lbs, notes } = req.body;

      if (!product_id || !quantity_lbs) {
        return res.status(400).json({ success: false, message: 'Product ID and quantity (lbs) are required' });
      }

      const qty = parseInt(quantity_lbs, 10);
      if (qty <= 0) {
        return res.status(400).json({ success: false, message: 'Quantity must be greater than 0' });
      }

      // Check product is a bean type
      const products = await query('SELECT type, name FROM products WHERE product_id = ?', [product_id]);
      if (products.length === 0) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      if (products[0].type !== 'bean') {
        return res.status(400).json({ success: false, message: 'Quotes can only be requested for wholesale coffee beans' });
      }

      // Insert Quote Request
      const quoteResult = await query(
        'INSERT INTO quotes (user_id, product_id, quantity_lbs, notes, status) VALUES (?, ?, ?, ?, ?)',
        [userId, product_id, qty, notes || null, 'pending']
      );

      return res.status(201).json({
        success: true,
        message: 'Wholesale quote request submitted successfully',
        quote_id: quoteResult.insertId,
        product_name: products[0].name,
        quantity_lbs: qty
      });
    }

    // 3. DELETE: Cancel/delete user's own quote request
    if (req.method === 'DELETE') {
      const quoteId = req.query.quote_id ? parseInt(req.query.quote_id, 10) : null;
      if (!quoteId) {
        return res.status(400).json({ success: false, message: 'Quote ID is required' });
      }

      // Check ownership
      const checkQuote = await query('SELECT user_id FROM quotes WHERE quote_id = ?', [quoteId]);
      if (checkQuote.length === 0) {
        return res.status(404).json({ success: false, message: 'Quote not found' });
      }

      if (checkQuote[0].user_id !== userId) {
        return res.status(403).json({ success: false, message: 'Forbidden: You do not own this quote request' });
      }

      await query('DELETE FROM quotes WHERE quote_id = ? AND user_id = ?', [quoteId, userId]);
      return res.status(200).json({ success: true, message: 'Quote request cancelled and deleted successfully' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  } catch (error) {
    console.error('Quotes API error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process quote action', error: error.message });
  }
};
