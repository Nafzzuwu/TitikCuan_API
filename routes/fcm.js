const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const pool = require('../config/db');
const admin = require('firebase-admin');

// Init firebase admin (hanya sekali)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Simpan FCM token
router.post('/token', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    await pool.query(
      `
      INSERT INTO user_devices (user_id, fcm_token, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET fcm_token = $2, updated_at = NOW()
      `,
      [userId, token]
    );

    res.json({ message: 'FCM token saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Broadcast notifikasi ke semua user
router.post('/broadcast', async (req, res) => {
  try {
    const { title, body, secret } = req.body;

    // Simple secret key biar tidak sembarangan orang bisa broadcast
    if (secret !== process.env.BROADCAST_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!title || !body) {
      return res.status(400).json({ error: 'title and body are required' });
    }

    // Ambil semua FCM token
    const result = await pool.query('SELECT fcm_token FROM user_devices');
    const tokens = result.rows.map(r => r.fcm_token);

    if (tokens.length === 0) {
      return res.json({ message: 'No devices registered', sent: 0 });
    }

    // Kirim ke semua token sekaligus
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
    });

    res.json({
      message: 'Broadcast sent',
      sent: response.successCount,
      failed: response.failureCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;