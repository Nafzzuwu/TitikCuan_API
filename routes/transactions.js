const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const pool = require('../config/db');


/**
 * @swagger
 * /transactions:
 *   post:
 *     summary: Buat transaksi baru
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               latitude:
 *                 type: number
 *                 example: -8.173
 *               longitude:
 *                 type: number
 *                 example: 113.699
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     product_id:
 *                       type: integer
 *                       example: 1
 *                     qty:
 *                       type: integer
 *                       example: 2
 *     responses:
 *       201:
 *         description: Transaksi berhasil dibuat
 */
router.post(
  '/',
  authMiddleware,
  async (req, res) => {

    const client =
      await pool.connect();

    try {

      const {
        latitude,
        longitude,
        items
      } = req.body;

      await client.query('BEGIN');

      let totalPrice = 0;

      const itemDetails = [];

      // cek product & hitung total
      for (const item of items) {

        const productResult =
          await client.query(
            `
            SELECT *
            FROM products
            WHERE id = $1
            AND user_id = $2
            `,
            [
              item.product_id,
              req.user.id
            ]
          );

        if (
          productResult.rows.length
          === 0
        ) {
          throw new Error(
            `Product ${item.product_id} not found`
          );
        }

        const product =
          productResult.rows[0];

        // cek stock
        if (
          product.stock
          < item.qty
        ) {
          throw new Error(
            `Stock not enough for ${product.name}`
          );
        }

        const subtotal =
          product.price *
          item.qty;

        totalPrice +=
          subtotal;

        itemDetails.push({
          product_id:
            product.id,
          qty:
            item.qty,
          subtotal
        });
      }

      // insert transaction
      const transactionResult =
        await client.query(
          `
          INSERT INTO transactions
          (
            user_id,
            total_price,
            latitude,
            longitude
          )
          VALUES ($1,$2,$3,$4)
          RETURNING *
          `,
          [
            req.user.id,
            totalPrice,
            latitude,
            longitude
          ]
        );

      const transaction =
        transactionResult.rows[0];

      // insert items
      for (
        const item
        of itemDetails
      ) {

        await client.query(
          `
          INSERT INTO transaction_items
          (
            transaction_id,
            product_id,
            qty,
            subtotal
          )
          VALUES ($1,$2,$3,$4)
          `,
          [
            transaction.id,
            item.product_id,
            item.qty,
            item.subtotal
          ]
        );

        // kurangi stock
        await client.query(
          `
          UPDATE products
          SET stock =
          stock - $1
          WHERE id = $2
          `,
          [
            item.qty,
            item.product_id
          ]
        );
      }

      await client.query(
        'COMMIT'
      );

      res.status(201).json({
        message:
          'Transaction success',
        transaction
      });

    } catch (err) {

      await client.query(
        'ROLLBACK'
      );

      res.status(500).json({
        error:
          err.message
      });

    } finally {
      client.release();
    }
  }
);

/**
 * @swagger
 * /transactions:
 *   get:
 *     summary: Ambil semua transaksi user
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List transaksi
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
          FROM transactions
          WHERE user_id = $1
          ORDER BY created_at DESC
          `,
          [req.user.id]
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

/**
 * @swagger
 * /transactions/{id}:
 *   get:
 *     summary: Ambil detail transaksi
 *     tags:
 *       - Transactions
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
 *         description: Detail transaksi berhasil
 */
router.get(
  '/:id',
  authMiddleware,
  async (req, res) => {

    try {

      const { id } =
        req.params;

      // ambil transaksi
      const transactionResult =
        await pool.query(
          `
          SELECT *
          FROM transactions
          WHERE id = $1
          AND user_id = $2
          `,
          [
            id,
            req.user.id
          ]
        );

      if (
        transactionResult
          .rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            message:
              'Transaction not found'
          });
      }

      const transaction =
        transactionResult
          .rows[0];

      // ambil item transaksi
      const itemsResult =
        await pool.query(
          `
          SELECT
            ti.id,
            ti.qty,
            ti.subtotal,
            p.name
              AS product_name,
            p.barcode,
            p.price
          FROM
            transaction_items ti
          JOIN
            products p
          ON
            ti.product_id = p.id
          WHERE
            ti.transaction_id = $1
          `,
          [id]
        );

      res.json({
        transaction,
        items:
          itemsResult.rows
      });

    } catch (err) {

      res.status(500).json({
        error:
          err.message
      });

    }
  }
);

/**
 * @swagger
 * /transactions/barcode:
 *   post:
 *     summary: Buat transaksi baru menggunakan barcode
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               latitude:
 *                 type: number
 *                 example: -8.173
 *               longitude:
 *                 type: number
 *                 example: 113.699
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     barcode:
 *                       type: string
 *                       example: "8991234567890"
 *                     qty:
 *                       type: integer
 *                       example: 2
 *     responses:
 *       201:
 *         description: Transaksi berhasil dibuat
 */
router.post(
  '/barcode',
  authMiddleware,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const {
        latitude,
        longitude,
        items
      } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          error: 'Items array is required and cannot be empty'
        });
      }

      // Group items by barcode to prevent stock check bypass on duplicates
      const consolidatedItems = [];
      const barcodeMap = {};
      for (const item of items) {
        if (!item.barcode || typeof item.qty !== 'number' || item.qty <= 0) {
          return res.status(400).json({
            error: 'Invalid item format. Each item must have a valid barcode and positive qty'
          });
        }
        if (barcodeMap[item.barcode]) {
          barcodeMap[item.barcode].qty += item.qty;
        } else {
          barcodeMap[item.barcode] = { barcode: item.barcode, qty: item.qty };
          consolidatedItems.push(barcodeMap[item.barcode]);
        }
      }

      await client.query('BEGIN');

      let totalPrice = 0;
      const itemDetails = [];

      // Cek product & hitung total
      for (const item of consolidatedItems) {
        const productResult = await client.query(
          `
          SELECT *
          FROM products
          WHERE barcode = $1
          AND user_id = $2
          `,
          [item.barcode, req.user.id]
        );

        if (productResult.rows.length === 0) {
          throw new Error(`Product with barcode ${item.barcode} not found`);
        }

        const product = productResult.rows[0];

        // Cek stock
        if (product.stock < item.qty) {
          throw new Error(`Stock not enough for ${product.name}`);
        }

        const subtotal = product.price * item.qty;
        totalPrice += subtotal;

        itemDetails.push({
          product_id: product.id,
          qty: item.qty,
          subtotal
        });
      }

      // Insert transaction
      const transactionResult = await client.query(
        `
        INSERT INTO transactions
        (
          user_id,
          total_price,
          latitude,
          longitude
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          req.user.id,
          totalPrice,
          latitude,
          longitude
        ]
      );

      const transaction = transactionResult.rows[0];

      // Insert transaction items & update stock
      for (const item of itemDetails) {
        await client.query(
          `
          INSERT INTO transaction_items
          (
            transaction_id,
            product_id,
            qty,
            subtotal
          )
          VALUES ($1, $2, $3, $4)
          `,
          [
            transaction.id,
            item.product_id,
            item.qty,
            item.subtotal
          ]
        );

        // Kurangi stock
        await client.query(
          `
          UPDATE products
          SET stock = stock - $1
          WHERE id = $2
          `,
          [item.qty, item.product_id]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Transaction success',
        transaction
      });

    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({
        error: err.message
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;