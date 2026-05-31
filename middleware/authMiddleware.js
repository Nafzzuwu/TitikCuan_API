const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: 'Access denied. No token provided'
      });
    }

    const token = authHeader.split(' ')[1];

    const verified = jwt.verify(token, process.env.JWT_SECRET);

    // Cek token aktif di database
    const result = await pool.query(
      `SELECT active_token FROM users WHERE id = $1`,
      [verified.id]
    );

    if (!result.rows[0] || result.rows[0].active_token !== token) {
      return res.status(401).json({
        message: 'Session expired, please login again'
      });
    }

    req.user = verified;
    next();
  } catch (err) {
    res.status(401).json({
      message: 'Invalid token'
    });
  }
};

module.exports = authMiddleware;