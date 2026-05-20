const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const transporter = require('../config/mailer');
const authMiddleware = require('../middleware/authMiddleware');
const crypto = require('crypto');





/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register user baru
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Namakamu
 *               business_name:
 *                 type: string
 *                 example: TitikCuan Store
 *               email:
 *                 type: string
 *                 example: contoh@gmail.com
 *               password:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       201:
 *         description: Register berhasil
 */
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      business_name,
      email,
      password
    } = req.body;

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const token = crypto.randomBytes(16).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const result =
      await pool.query(
        `
        INSERT INTO users
        (
          name,
          business_name,
          email,
          password,
          otp,
          otp_expires_at,
          is_verified
        )
        VALUES ($1,$2,$3,$4,$5,$6,FALSE)
        RETURNING id,name,
        business_name,email
        `,
        [
          name,
          business_name,
          email,
          hashedPassword,
          token,
          tokenExpiresAt
        ]
      );

    const verificationLink = `${process.env.BASE_URL}/auth/verify?token=${token}&email=${email}`;

    const mailOptions = {
      from: `"TitikCuan" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verifikasi Akun - TitikCuan',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #4CAF50; text-align: center;">Verifikasi Akun TitikCuan</h2>
          <p>Halo ${name},</p>
          <p>Terima kasih telah mendaftar di TitikCuan. Silakan klik tombol di bawah ini untuk memverifikasi akun Anda:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">Verifikasi Akun</a>
          </div>
          <p>Jika tombol di atas tidak berfungsi, Anda juga dapat menyalin dan menempelkan link berikut di browser Anda:</p>
          <p style="word-break: break-all; color: #0066cc;"><a href="${verificationLink}">${verificationLink}</a></p>
          <p style="color: #FF5722;">*Link verifikasi ini hanya berlaku selama 15 menit.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #777; text-align: center;">Ini adalah email otomatis, mohon tidak membalas email ini.</p>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`[VERIFICATION] Link terkirim ke ${email}`);
    } catch (mailError) {
      console.log(`==================================================`);
      console.log(`[ALERT] Gagal mengirim link verifikasi ke ${email}: ${mailError.message}`);
      console.log(`[DEBUG LINK] Gunakan link ini untuk testing: ${verificationLink}`);
      console.log(`==================================================`);
    }

    res.status(201).json({
      message: 'Register success. Please check your email to verify your account.',
      user: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: contoh@gmail.com
 *               password:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: Login berhasil
 */
router.post('/login', async (req, res) => {
  try {
    const {
      email,
      password
    } = req.body;

    const result =
      await pool.query(
        `
        SELECT *
        FROM users
        WHERE email = $1
        `,
        [email]
      );

    const user =
      result.rows[0];

    if (!user) {
      return res
        .status(404)
        .json({
          message:
            'User not found'
        });
    }

    const isMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!isMatch) {
      return res
        .status(400)
        .json({
          message:
            'Wrong password'
        });
    }

    if (user.is_active === false) {
      return res
        .status(403)
        .json({
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Account is deactivated'
        });
    }

    if (user.is_verified === false) {
      const verifyToken = crypto.randomBytes(16).toString('hex');
      const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await pool.query(
        'UPDATE users SET otp = $1, otp_expires_at = $2 WHERE id = $3',
        [verifyToken, tokenExpiresAt, user.id]
      );

      const verificationLink = `${process.env.BASE_URL}/auth/verify?token=${verifyToken}&email=${user.email}`;

      const mailOptions = {
        from: `"TitikCuan" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: 'Verifikasi Akun - TitikCuan',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #4CAF50; text-align: center;">Verifikasi Akun TitikCuan</h2>
            <p>Halo ${user.name},</p>
            <p>Akun Anda belum terverifikasi. Silakan klik tombol di bawah ini untuk memverifikasi akun Anda:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">Verifikasi Akun</a>
            </div>
            <p>Jika tombol di atas tidak berfungsi, Anda juga dapat menyalin dan menempelkan link berikut di browser Anda:</p>
            <p style="word-break: break-all; color: #0066cc;"><a href="${verificationLink}">${verificationLink}</a></p>
            <p style="color: #FF5722;">*Link verifikasi ini hanya berlaku selama 15 menit.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #777; text-align: center;">Ini adalah email otomatis, mohon tidak membalas email ini.</p>
          </div>
        `
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`[RESEND VERIFICATION] Link terkirim ke ${user.email}`);
      } catch (mailError) {
        console.log(`==================================================`);
        console.log(`[ALERT] Gagal mengirim link verifikasi ke ${user.email}: ${mailError.message}`);
        console.log(`[DEBUG LINK] Gunakan link ini untuk testing: ${verificationLink}`);
        console.log(`==================================================`);
      }

      return res
        .status(403)
        .json({
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Email belum diverifikasi. Link verifikasi baru telah dikirim ke email Anda.'
        });
    }

    const token =

      jwt.sign(

        {
          id: user.id,
          email: user.email
        },
        process.env.JWT_SECRET,
        {
          expiresIn: '7d'
        }
      );

    res.json({
      message:
        'Login success',
      token,
      user: {
        id: user.id,
        name: user.name,
        business_name:
          user.business_name,
        email:
          user.email
      }
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request OTP reset password
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: contoh@gmail.com
 *     responses:
 *       200:
 *         description: OTP berhasil dikirim ke email
 *       404:
 *         description: Email tidak terdaftar
 *       500:
 *         description: Server error
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Email not registered' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await pool.query(
      'UPDATE users SET otp = $1, otp_expires_at = $2 WHERE email = $3',
      [otp, otpExpiresAt, email]
    );

    const mailOptions = {
      from: `"TitikCuan" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Password OTP - TitikCuan',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #4CAF50; text-align: center;">Reset Password TitikCuan</h2>
          <p>Halo,</p>
          <p>Kami menerima permintaan untuk mereset password akun Anda. Silakan gunakan kode OTP berikut untuk melanjutkan:</p>
          <div style="background-color: #f2f2f2; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #333; border-radius: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #FF5722;">*Kode OTP ini hanya berlaku selama 5 menit. Jangan bagikan kode ini kepada siapapun.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #777; text-align: center;">Ini adalah email otomatis, mohon tidak membalas email ini.</p>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`[OTP] Email terkirim ke ${email} | OTP: ${otp}`);
    } catch (mailError) {
      console.log(`==================================================`);
      console.log(`[ALERT] Gagal mengirim email ke ${email}: ${mailError.message}`);
      console.log(`[DEBUG OTP] Gunakan OTP ini untuk testing: ${otp}`);
      console.log(`==================================================`);
    }

    res.json({ message: 'OTP sent to email successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password dengan OTP
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: contoh@gmail.com
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               new_password:
 *                 type: string
 *                 example: "newpassword123"
 *     responses:
 *       200:
 *         description: Password berhasil diubah
 *       400:
 *         description: OTP tidak valid atau kedaluwarsa
 *       404:
 *         description: User tidak ditemukan
 *       500:
 *         description: Server error
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;

    const userResult = await pool.query(
      'SELECT id, otp, otp_expires_at FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    const now = new Date();
    if (new Date(user.otp_expires_at) < now) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await pool.query(
      'UPDATE users SET password = $1, otp = NULL, otp_expires_at = NULL WHERE id = $2',
      [hashedPassword, user.id]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /auth/deactivate:
 *   post:
 *     summary: Menonaktifkan akun user (Soft Delete)
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Akun berhasil dinonaktifkan
 *       500:
 *         description: Server error
 */
router.post('/deactivate', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    await pool.query('UPDATE users SET is_active = FALSE WHERE id = $1', [userId]);
    res.json({ message: 'Account deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /auth/reactivate:
 *   post:
 *     summary: Mengaktifkan kembali akun yang dinonaktifkan
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: contoh@gmail.com
 *               password:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: Akun berhasil diaktifkan kembali dan login berhasil
 *       400:
 *         description: Password salah
 *       404:
 *         description: User tidak ditemukan
 *       500:
 *         description: Server error
 */
router.post('/reactivate', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Wrong password' });
    }

    await pool.query('UPDATE users SET is_active = TRUE WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Account reactivated successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        business_name: user.business_name,
        email: user.email
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /auth/verify:
 *   get:
 *     summary: Verifikasi email via link
 *     tags:
 *       - Authentication
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tampilan HTML verifikasi sukses atau gagal
 */
router.get('/verify', async (req, res) => {
  try {
    const { token, email } = req.query;

    const result = await pool.query(
      'SELECT id, otp_expires_at FROM users WHERE email = $1 AND otp = $2',
      [email, token]
    );

    if (result.rows.length === 0) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verifikasi Gagal - TitikCuan</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
            h1 { color: #f44336; margin-bottom: 10px; font-size: 24px; }
            p { color: #666; line-height: 1.6; margin-bottom: 25px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Verifikasi Gagal</h1>
            <p>Link verifikasi tidak valid, sudah digunakan, atau telah kedaluwarsa. Silakan lakukan registrasi ulang atau hubungi tim bantuan.</p>
          </div>
        </body>
        </html>
      `);
    }

    const user = result.rows[0];
    const now = new Date();
    if (new Date(user.otp_expires_at) < now) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verifikasi Kedaluwarsa - TitikCuan</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
            h1 { color: #ff9800; margin-bottom: 10px; font-size: 24px; }
            p { color: #666; line-height: 1.6; margin-bottom: 25px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Verifikasi Kedaluwarsa</h1>
            <p>Link verifikasi ini telah kedaluwarsa (berlaku 15 menit). Silakan lakukan registrasi ulang.</p>
          </div>
        </body>
        </html>
      `);
    }

    await pool.query(
      'UPDATE users SET is_verified = TRUE, otp = NULL, otp_expires_at = NULL WHERE id = $1',
      [user.id]
    );

    res.send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifikasi Berhasil - TitikCuan</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
          h1 { color: #4caf50; margin-bottom: 10px; font-size: 24px; }
          p { color: #666; line-height: 1.6; margin-bottom: 25px; }
          .icon { font-size: 50px; color: #4caf50; margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h1>Verifikasi Berhasil!</h1>
          <p>Akun Anda telah berhasil diaktifkan. Silakan kembali ke aplikasi <strong>TitikCuan</strong> dan masuk menggunakan akun Anda.</p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`<h3>Terjadi kesalahan pada server: ${err.message}</h3>`);
  }
});

module.exports = router;

