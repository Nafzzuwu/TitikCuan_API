const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const pool = require('../config/db');


// GET PRODUCTS
/**
 * @swagger
 * /products:
 *   get:
 *     summary: Ambil semua produk milik user
 *     tags:
 *       - Products
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List produk berhasil diambil
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
      const result =
        await pool.query(
          `
          SELECT *
          FROM products
          WHERE user_id = $1
          ORDER BY id ASC
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

// POST PRODUCT
/**
 * @swagger
 * /products:
 *   post:
 *     summary: Tambah produk baru
 *     tags:
 *       - Products
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - stock
 *             properties:
 *               barcode:
 *                 type: string
 *                 nullable: true
 *                 example: "8991234567890"
 *               name:
 *                 type: string
 *                 example: "Kopi Sachet"
 *               price:
 *                 type: integer
 *                 example: 3000
 *               stock:
 *                 type: integer
 *                 example: 50
 *               min_stock:
 *                 type: integer
 *                 example: 5
 *                 default: 5
 *               image_url:
 *                 type: string
 *                 example: "https://example.com/kopi.jpg"
 *                 nullable: true
 *               category:
 *                 type: string
 *                 example: "Minuman"
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Produk berhasil ditambahkan
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
router.post(
  '/',
  authMiddleware,
  async (req, res) => {
    try {
      const {
        barcode,
        name,
        price,
        stock,
        min_stock = 5,
        image_url = null,
        category = null
      } = req.body;

      const result =
        await pool.query(
          `
          INSERT INTO products
          (
            user_id,
            barcode,
            name,
            price,
            stock,
            min_stock,
            image_url,
            category
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
          `,
          [
            req.user.id,
            barcode,
            name,
            price,
            stock,
            min_stock,
            image_url,
            category
          ]
        );

      res.status(201).json(
        result.rows[0]
      );
    } catch (err) {
      res.status(500).json({
        error: err.message
      });
    }
  }
);

// UPDATE PRODUCT
/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Update produk
 *     tags:
 *       - Products
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               barcode:
 *                 type: string
 *                 nullable: true
 *               name:
 *                 type: string
 *               price:
 *                 type: integer
 *               stock:
 *                 type: integer
 *               min_stock:
 *                 type: integer
 *                 example: 5
 *               image_url:
 *                 type: string
 *                 example: "https://example.com/kopi.jpg"
 *                 nullable: true
 *               category:
 *                 type: string
 *                 example: "Minuman"
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Produk berhasil diupdate
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
 *       404:
 *         description: Produk tidak ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Product not found
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
router.put(
  '/:id',
  authMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        barcode,
        name,
        price,
        stock,
        min_stock,
        image_url,
        category
      } = req.body;

      const result =
        await pool.query(
          `
          UPDATE products
          SET
            barcode = $1,
            name = $2,
            price = $3,
            stock = $4,
            min_stock = $5,
            image_url = $6,
            category = $7
          WHERE id = $8
          AND user_id = $9
          RETURNING *
          `,
          [
            barcode,
            name,
            price,
            stock,
            min_stock,
            image_url,
            category,
            id,
            req.user.id
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            message:
              'Product not found'
          });
      }

      if (result.rows[0].stock > result.rows[0].min_stock) {
        await pool.query(
          `DELETE FROM stock_alerts 
          WHERE product_id = $1 
          AND user_id = $2`,
          [id, req.user.id]
        );
      }

      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({
        error: err.message
      });
    }
  }
);

// DELETE PRODUCT
/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Hapus produk
 *     tags:
 *       - Products
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
 *         description: Produk berhasil dihapus
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
 *       404:
 *         description: Produk tidak ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Product not found
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
router.delete(
  '/:id',
  authMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;

      const result =
        await pool.query(
          `
          DELETE FROM products
          WHERE id = $1
          AND user_id = $2
          RETURNING *
          `,
          [
            id,
            req.user.id
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            message:
              'Product not found'
          });
      }

      res.json({
        message:
          'Product deleted'
      });
    } catch (err) {
      res.status(500).json({
        error: err.message
      });
    }
  }
);

// GET PRODUCT BY BARCODE
/**
 * @swagger
 * /products/barcode/{barcode}:
 *   get:
 *     summary: Cari produk berdasarkan barcode
 *     tags:
 *       - Products
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: barcode
 *         required: true
 *         schema:
 *           type: string
 *         example: "8991234567890"
 *     responses:
 *       200:
 *         description: Detail produk berhasil ditemukan
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
 *       404:
 *         description: Produk tidak ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Product not found
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
  '/barcode/:barcode',
  authMiddleware,
  async (req, res) => {
    try {
      const { barcode } = req.params;
      const result = await pool.query(
        `
        SELECT id, barcode, name, price, stock
        FROM products
        WHERE barcode = $1
        AND user_id = $2
        `,
        [barcode, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'Product not found'
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

// PATCH UPDATE STOCK
/**
 * @swagger
 * /products/{id}/stock:
 *   patch:
 *     summary: Update stok produk saja
 *     tags:
 *       - Products
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stock:
 *                 type: integer
 *                 example: 20
 *     responses:
 *       200:
 *         description: Stok berhasil diupdate
 *       400:
 *         description: Request tidak valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: stock field is required and must be a number
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
 *       404:
 *         description: Produk tidak ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Product not found
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
router.patch(
  '/:id/stock',
  authMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { stock } = req.body;

      if (stock === undefined || typeof stock !== 'number') {
        return res.status(400).json({
          error: 'stock field is required and must be a number'
        });
      }

      const result = await pool.query(
        `
        UPDATE products
        SET stock = $1
        WHERE id = $2
        AND user_id = $3
        RETURNING *
        `,
        [stock, id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'Product not found'
        });
      }

      if (stock > result.rows[0].min_stock) {
        await pool.query(
          `DELETE FROM stock_alerts 
          WHERE product_id = $1 
          AND user_id = $2`,
          [id, req.user.id]
        );
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