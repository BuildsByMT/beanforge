const { query } = require('./db');

module.exports = async function handler(req, res) {
  try {
    // Run a bogus query that requires minimal database work
    await query('SELECT 1');
    return res.status(200).json({
      success: true,
      message: 'Keep-alive query executed successfully on Aiven MySQL.'
    });
  } catch (error) {
    console.error('Keep-alive failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
