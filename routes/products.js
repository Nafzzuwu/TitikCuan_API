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
 *             properties:
 *               barcode:
 *                 type: string
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
 *     responses:
 *       201:
 *         description: Produk berhasil ditambahkan
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
        stock
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
            stock
          )
          VALUES ($1,$2,$3,$4,$5)
          RETURNING *
          `,
          [
            req.user.id,
            barcode,
            name,
            price,
            stock
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
 *               name:
 *                 type: string
 *               price:
 *                 type: integer
 *               stock:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Produk berhasil diupdate
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
        stock
      } = req.body;

      const result =
        await pool.query(
          `
          UPDATE products
          SET
            barcode = $1,
            name = $2,
            price = $3,
            stock = $4
          WHERE id = $5
          AND user_id = $6
          RETURNING *
          `,
          [
            barcode,
            name,
            price,
            stock,
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

module.exports = router;