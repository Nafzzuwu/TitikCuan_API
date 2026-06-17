const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const pool = require('../config/db');


/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: Dashboard analytics user
 *     tags:
 *       - Dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard analytics berhasil
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

      const userId =
        req.user.id;

      // penjualan hari ini
      const todaySales =
        await pool.query(
          `
          SELECT
            COALESCE(
              SUM(total_price),
              0
            ) AS total
          FROM transactions
          WHERE user_id = $1
          AND DATE(created_at)
          = CURRENT_DATE
          `,
          [userId]
        );

      // penjualan bulan ini
      const monthlySales =
        await pool.query(
          `
          SELECT
            COALESCE(
              SUM(total_price),
              0
            ) AS total
          FROM transactions
          WHERE user_id = $1
          AND DATE_TRUNC(
            'month',
            created_at
          )
          =
          DATE_TRUNC(
            'month',
            CURRENT_DATE
          )
          `,
          [userId]
        );

      // total transaksi
      const totalTransactions =
        await pool.query(
          `
          SELECT COUNT(*)
          FROM transactions
          WHERE user_id = $1
          `,
          [userId]
        );

      // produk terlaris
      const bestSelling =
        await pool.query(
          `
          SELECT
            p.name,
            SUM(ti.qty)
            AS total_sold
          FROM
            transaction_items ti
          JOIN
            products p
          ON
            ti.product_id = p.id
          WHERE
            p.user_id = $1
          GROUP BY
            p.id
          ORDER BY
            total_sold DESC
          LIMIT 1
          `,
          [userId]
        );

      // stok menipis
      const lowStock =
        await pool.query(
          `
          SELECT COUNT(*)
          FROM products
          WHERE user_id = $1
          AND stock <= min_stock
          `,
          [userId]
        );

      res.json({

        today_sales:
          Number(
            todaySales
            .rows[0]
            .total
          ),

        monthly_sales:
          Number(
            monthlySales
            .rows[0]
            .total
          ),

        total_transactions:
          Number(
            totalTransactions
            .rows[0]
            .count
          ),

        best_selling_product:
          bestSelling
          .rows[0]?.name
          || 'No Sales Yet',

        low_stock_products:
          Number(
            lowStock
            .rows[0]
            .count
          )

      });

    } catch (err) {

      res.status(500).json({
        error:
          err.message
      });

    }
  }
);

module.exports = router;