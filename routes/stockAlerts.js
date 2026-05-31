const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const pool = require('../config/db');

// GET STOCK ALERTS
/**
 * @swagger
 * /stock-alerts:
 *   get:
 *     summary: Ambil semua alert stok belum dibaca milik user
 *     tags:
 *       - Stock Alerts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil alert
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   product_id:
 *                     type: integer
 *                   stock_at_alert:
 *                     type: integer
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *                   is_read:
 *                     type: boolean
 *                   created_at:
 *                     type: string
 *                   product_name:
 *                     type: string
 *                   barcode:
 *                     type: string
 */
router.get(
  '/',
  authMiddleware,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT 
          sa.id,
          sa.product_id,
          sa.stock_at_alert,
          sa.latitude,
          sa.longitude,
          sa.is_read,
          sa.created_at,
          p.name AS product_name,
          p.barcode,
          p.min_stock          -- ← tambah ini
        FROM stock_alerts sa
        JOIN products p ON sa.product_id = p.id
        WHERE sa.user_id = $1
        AND sa.is_read = FALSE
        ORDER BY sa.created_at DESC
        `,
        [req.user.id]
      );

      res.json(result.rows);
    } catch (err) {
      res.status(500).json({
        error: err.message
      });
    }
  }
);

// PATCH READ STOCK ALERT
/**
 * @swagger
 * /stock-alerts/{id}/read:
 *   patch:
 *     summary: Tandai alert stok sudah dibaca
 *     tags:
 *       - Stock Alerts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Peringatan berhasil ditandai telah dibaca
 *       404:
 *         description: Alert tidak ditemukan
 */
router.patch(
  '/:id/read',
  authMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `
        UPDATE stock_alerts
        SET is_read = TRUE
        WHERE id = $1
        AND user_id = $2
        RETURNING *
        `,
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'Stock alert not found'
        });
      }

      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({
        error: err.message
      });
    }
  }
);

module.exports = router;
