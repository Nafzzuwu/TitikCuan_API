const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const pool = require('../config/db');
const admin = require('firebase-admin');

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
 *               payment_method:
 *                 type: string
 *                 enum: [cash, transfer, qris]
 *                 default: cash
 *                 example: cash
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
router.post('/', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { latitude, longitude, items, payment_method = 'cash' } = req.body;
    const validPaymentMethods = ['cash', 'transfer', 'qris'];
    if (!validPaymentMethods.includes(payment_method)) {
      return res.status(400).json({
        error: `Invalid payment_method. Allowed values: ${validPaymentMethods.join(', ')}`
      });
    }
    await client.query('BEGIN');
    let totalPrice = 0;
    const itemDetails = [];
    for (const item of items) {
      const productResult = await client.query(
        `SELECT * FROM products WHERE id = $1 AND user_id = $2`,
        [item.product_id, req.user.id]
      );
      if (productResult.rows.length === 0) {
        throw new Error(`Product ${item.product_id} not found`);
      }
      const product = productResult.rows[0];
      if (product.stock < item.qty) {
        throw new Error(`Stock not enough for ${product.name}`);
      }
      const subtotal = product.price * item.qty;
      totalPrice += subtotal;
      itemDetails.push({
        product_id: product.id,
        qty: item.qty,
        subtotal,
        productName: product.name,
        currentStock: product.stock,
        minStock: product.min_stock
      });
    }
    const transactionResult = await client.query(
      `INSERT INTO transactions (user_id, total_price, latitude, longitude, payment_method)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, totalPrice, latitude, longitude, payment_method]
    );
    const transaction = transactionResult.rows[0];
    for (const item of itemDetails) {
      await client.query(
        `INSERT INTO transaction_items (transaction_id, product_id, qty, subtotal) VALUES ($1, $2, $3, $4)`,
        [transaction.id, item.product_id, item.qty, item.subtotal]
      );
      await client.query(`UPDATE products SET stock = stock - $1 WHERE id = $2`, [item.qty, item.product_id]);
      const newStock = item.currentStock - item.qty;
      const minStockLimit = item.minStock !== null && item.minStock !== undefined ? item.minStock : 5;
      if (newStock <= minStockLimit) {
        await client.query(
          `INSERT INTO stock_alerts (user_id, product_id, stock_at_alert, latitude, longitude)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.user.id, item.product_id, newStock, latitude, longitude]
        );
        const deviceResult = await client.query(`SELECT fcm_token FROM user_devices WHERE user_id = $1`, [req.user.id]);
        const fcmToken = deviceResult.rows[0]?.fcm_token;
        if (fcmToken) {
          await admin.messaging().send({
            token: fcmToken,
            notification: {
              title: '⚠️ Stok Menipis!',
              body: `${item.productName} tersisa ${newStock} pcs, segera restok!`,
            },
            android: {
              priority: 'high',
              notification: {
                channelId: 'high_importance_channel',
                priority: 'high',
                defaultSound: true,
              },
            },
          });
        }
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ message: 'Transaction success', transaction });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

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
router.get('/', authMiddleware, async (req, res) => {
  try {
    // MODIFIKASI: tambahkan subquery untuk mengambil nama produk pertama
    const result = await pool.query(
      `
      SELECT 
        t.*,
        (
          SELECT p.name 
          FROM transaction_items ti
          JOIN products p ON ti.product_id = p.id
          WHERE ti.transaction_id = t.id
          LIMIT 1
        ) AS first_product_name
      FROM transactions t
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
      `,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const transactionResult = await pool.query(
      `SELECT * FROM transactions WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );
    if (transactionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    const transaction = transactionResult.rows[0];
    const itemsResult = await pool.query(
      `SELECT ti.id, ti.qty, ti.subtotal, p.name AS product_name, p.barcode, p.price
       FROM transaction_items ti
       JOIN products p ON ti.product_id = p.id
       WHERE ti.transaction_id = $1`,
      [id]
    );
    res.json({ transaction, items: itemsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
 *               payment_method:
 *                 type: string
 *                 enum: [cash, transfer, qris]
 *                 default: cash
 *                 example: cash
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
 *       400:
 *         description: Input tidak valid atau produk tidak memiliki barcode
 */
router.post('/barcode', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { latitude, longitude, items, payment_method = 'cash' } = req.body;
    const validPaymentMethods = ['cash', 'transfer', 'qris'];
    if (!validPaymentMethods.includes(payment_method)) {
      return res.status(400).json({
        error: `Invalid payment_method. Allowed values: ${validPaymentMethods.join(', ')}`
      });
    }
    if (latitude === undefined || longitude === undefined || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude and longitude are required and must be numbers' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required and cannot be empty' });
    }
    const consolidatedItems = [];
    const barcodeMap = {};
    for (const item of items) {
      if (!item.barcode || typeof item.qty !== 'number' || item.qty <= 0) {
        return res.status(400).json({ error: 'Invalid item format. Each item must have a valid barcode and positive qty' });
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
    for (const item of consolidatedItems) {
      const productResult = await client.query(
        `SELECT * FROM products WHERE barcode = $1 AND user_id = $2`,
        [item.barcode, req.user.id]
      );
      if (productResult.rows.length === 0) {
        throw new Error(`Product with barcode ${item.barcode} not found`);
      }
      const product = productResult.rows[0];
      if (product.barcode === null) {
        throw new Error(`Product "${product.name}" tidak memiliki barcode. Gunakan endpoint transaksi biasa dengan product_id`);
      }
      if (product.stock < item.qty) {
        throw new Error(`Stock not enough for ${product.name}`);
      }
      const subtotal = product.price * item.qty;
      totalPrice += subtotal;
      itemDetails.push({
        product_id: product.id,
        qty: item.qty,
        subtotal,
        productName: product.name,
        currentStock: product.stock,
        minStock: product.min_stock
      });
    }
    const transactionResult = await client.query(
      `INSERT INTO transactions (user_id, total_price, latitude, longitude, payment_method)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, totalPrice, latitude, longitude, payment_method]
    );
    const transaction = transactionResult.rows[0];
    for (const item of itemDetails) {
      await client.query(
        `INSERT INTO transaction_items (transaction_id, product_id, qty, subtotal) VALUES ($1, $2, $3, $4)`,
        [transaction.id, item.product_id, item.qty, item.subtotal]
      );
      await client.query(`UPDATE products SET stock = stock - $1 WHERE id = $2`, [item.qty, item.product_id]);
      const newStock = item.currentStock - item.qty;
      const minStockLimit = item.minStock !== null && item.minStock !== undefined ? item.minStock : 5;
      if (newStock <= minStockLimit) {
        await client.query(
          `INSERT INTO stock_alerts (user_id, product_id, stock_at_alert, latitude, longitude)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.user.id, item.product_id, newStock, latitude, longitude]
        );
        const deviceResult = await client.query(`SELECT fcm_token FROM user_devices WHERE user_id = $1`, [req.user.id]);
        const fcmToken = deviceResult.rows[0]?.fcm_token;
        if (fcmToken) {
          await admin.messaging().send({
            token: fcmToken,
            notification: {
              title: '⚠️ Stok Menipis!',
              body: `${item.productName} tersisa ${newStock} pcs, segera restok!`,
            },
            android: {
              priority: 'high',
              notification: {
                channelId: 'high_importance_channel',
                priority: 'high',
                defaultSound: true,
              },
            },
          });
        }
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ message: 'Transaction success', transaction });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;