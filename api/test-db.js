const { query } = require('./db');

module.exports = async function handler(req, res) {
  try {
    const results = await query('SELECT 1 + 1 AS result');
    return res.status(200).json({
      success: true,
      message: 'Successfully connected to Railway MySQL database!',
      data: results
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to connect to database',
      error: error.message
    });
  }
};
