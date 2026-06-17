const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const pool = require('../config/db');


/**
 * @swagger
 * /heatmap:
 *   get:
 *     summary: Ambil data titik penjualan untuk heatmap
 *     tags:
 *       - Heatmap
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data heatmap berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                   lng:
 *                     type: number
 *                   intensity:
 *                     type: integer
 *       401:
 *         description: Token tidak valid atau tidak tersedia
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Access denied. No token provided
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */
router.get(
  '/',
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await pool.query(
        `
        SELECT
          latitude,
          longitude,
          COUNT(*) AS sales_count
        FROM transactions
        WHERE user_id = $1
        GROUP BY
          latitude,
          longitude
        `,
        [userId]
      );

      const formatted = result.rows.map(row => ({
        lat: parseFloat(row.latitude),
        lng: parseFloat(row.longitude),
        intensity: parseInt(row.sales_count, 10)
      }));

      res.json(formatted);

    } catch (err) {
      res.status(500).json({
        error: err.message
      });
    }
  }
);

module.exports = router;