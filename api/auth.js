const { query } = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'beanforge_super_secret_key_123!';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const { action } = req.query;
  const { username, email, password } = req.body; // Secure: Destructure only username, email, and password. Avoid 'role' injection.

  // 1. Password Length Check (Mitigates Long Password DoS on bcrypt)
  if (password) {
    if (password.length > 128) {
      return res.status(400).json({ success: false, message: 'Password is too long (maximum 128 characters).' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }
  }

  // 2. Email Validation (Mitigates ReDoS and enforces limits)
  if (email) {
    if (email.length > 150) {
      return res.status(400).json({ success: false, message: 'Email address exceeds maximum length.' });
    }
    // Catastrophic backtracking safe email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address format.' });
    }
  }

  // 3. Username Length Validation
  if (username && username.length > 50) {
    return res.status(400).json({ success: false, message: 'Username is too long (maximum 50 characters).' });
  }

  try {
    if (action === 'register') {
      if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: 'Username, email, and password are required.' });
      }

      // Check if user already exists
      const existingUsers = await query('SELECT * FROM users WHERE email = ? OR username = ?', [email, username]);
      if (existingUsers.length > 0) {
        return res.status(400).json({ success: false, message: 'Username or email is already registered.' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Insert user (default role is strictly 'customer' to prevent privilege escalation)
      const userRole = 'customer';
      const result = await query(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [username, email, passwordHash, userRole]
      );

      const userId = result.insertId;

      // Create JWT token
      const token = jwt.sign({ userId, username, email, role: userRole }, JWT_SECRET, { expiresIn: '7d' });

      return res.status(201).json({
        success: true,
        message: 'Registration successful',
        user: { user_id: userId, username, email, role: userRole },
        token
      });
    }

    if (action === 'login') {
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
      }

      // Find user by email
      const users = await query('SELECT * FROM users WHERE email = ?', [email]);
      if (users.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid email or password.' });
      }

      const user = users[0];

      // Compare password
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Invalid email or password.' });
      }

      // Create JWT token
      const token = jwt.sign(
        { userId: user.user_id, username: user.username, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        user: { user_id: user.user_id, username: user.username, email: user.email, role: user.role },
        token
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid action parameter. Must be "register" or "login".' });
  } catch (error) {
    console.error('Authentication Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
};
