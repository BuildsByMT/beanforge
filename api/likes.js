const { query } = require('./db');
const { verifyToken } = require('./authHelper');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const user = verifyToken(req);
      let userId = user ? user.userId : null;

      // Fallback to query parameter if no token is passed
      if (!userId && req.query.user_id) {
        userId = parseInt(req.query.user_id, 10);
      }

      if (!userId) {
        return res.status(400).json({ success: false, message: 'Authentication required or user_id must be provided' });
      }

      const likes = await query('SELECT product_id FROM likes WHERE user_id = ?', [userId]);
      const likedProductIds = likes.map(like => like.product_id);
      return res.status(200).json(likedProductIds);
    } catch (error) {
      console.error('Fetch likes error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch favorites', error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const user = verifyToken(req);
      let userId = user ? user.userId : null;

      const { user_id, product_id } = req.body;
      if (!userId && user_id) {
        userId = parseInt(user_id, 10);
      }

      if (!userId || !product_id) {
        return res.status(400).json({ success: false, message: 'User ID and Product ID are required' });
      }

      // Check if product exists
      const products = await query('SELECT product_id FROM products WHERE product_id = ?', [product_id]);
      if (products.length === 0) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      // Check if already liked
      const existingLikes = await query('SELECT * FROM likes WHERE user_id = ? AND product_id = ?', [userId, product_id]);

      if (existingLikes.length > 0) {
        // Unlike: delete row
        await query('DELETE FROM likes WHERE user_id = ? AND product_id = ?', [userId, product_id]);
        return res.status(200).json({ success: true, liked: false, message: 'Removed from favorites' });
      } else {
        // Like: insert row
        await query('INSERT INTO likes (user_id, product_id) VALUES (?, ?)', [userId, product_id]);
        return res.status(200).json({ success: true, liked: true, message: 'Added to favorites' });
      }
    } catch (error) {
      console.error('Toggle like error:', error);
      return res.status(500).json({ success: false, message: 'Failed to update favorite status', error: error.message });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
};
