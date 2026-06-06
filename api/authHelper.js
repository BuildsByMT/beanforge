const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'beanforge_super_secret_key_123!';

function verifyToken(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    
    let token = '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = authHeader;
    }

    if (!token) return null;

    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return null;
  }
}

module.exports = {
  verifyToken
};
