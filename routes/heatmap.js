const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const pool = require('../config/db');


/**
 * @swagger
 * /heatmap:
 *   get:
 *     summary: Ambil data titik penjualan
 *     tags:
 *       - Heatmap
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data heatmap berhasil diambil
 */
router.get(
  '/',
  authMiddleware,
  async (req, res) => {

    try {

      const userId =
        req.user.id;

      const result =
        await pool.query(
          `
          SELECT
            latitude,
            longitude,
            COUNT(*) AS sales_count,
            SUM(total_price)
              AS total_sales
          FROM transactions
          WHERE user_id = $1
          GROUP BY
            latitude,
            longitude
          ORDER BY
            total_sales DESC
          `,
          [userId]
        );

      res.json(
        result.rows
      );

    } catch (err) {

      res.status(500).json({
        error:
          err.message
      });

    }
  }
);

module.exports = router;