const { query } = require('./db');
const { verifyToken } = require('./authHelper');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { type, category } = req.query;
      let sql = 'SELECT * FROM products WHERE is_available = TRUE';
      const params = [];

      if (type && type !== 'all') {
        sql += ' AND type = ?';
        params.push(type);
      }

      if (category && category !== 'All') {
        sql += ' AND category = ?';
        params.push(category);
      }

      const products = await query(sql, params);
      return res.status(200).json(products);
    } catch (error) {
      console.error('Fetch products error:', error);
      return res.status(500).json({ success: false, message: 'Failed to retrieve products', error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const user = verifyToken(req);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
      }

      const { name, type, category, origin, roast_level, price, description, image_url, is_available } = req.body;

      if (!name || !type || price === undefined) {
        return res.status(400).json({ success: false, message: 'Name, type, and price are required.' });
      }

      const result = await query(
        'INSERT INTO products (name, type, category, origin, roast_level, price, description, image_url, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          name, 
          type, 
          category || null, 
          origin || null, 
          roast_level || null, 
          price, 
          description || null, 
          image_url || null, 
          is_available !== undefined ? is_available : true
        ]
      );

      return res.status(201).json({
        success: true,
        message: 'Product created successfully',
        product_id: result.insertId
      });
    } catch (error) {
      console.error('Create product error:', error);
      return res.status(500).json({ success: false, message: 'Failed to create product', error: error.message });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
};
