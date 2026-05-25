# TitikCuan API - Backend Service 🪙

TitikCuan API adalah layanan RESTful API backend yang dirancang untuk mendukung sistem manajemen penjualan, inventaris, dan analitik bisnis TitikCuan. API ini dikembangkan menggunakan **Node.js** dan **Express.js**, terhubung dengan database **PostgreSQL** (melalui Supabase), menggunakan **JWT (JSON Web Token)** untuk otentikasi keamanan, **Nodemailer** untuk pengiriman verifikasi email dan OTP, serta didokumentasikan menggunakan **OpenAPI 3.0 / Swagger**.

---

## 🚀 Fitur Utama

1. **Sistem Otentikasi & Keamanan Lengkap**:
   - Pendaftaran akun baru dengan verifikasi tautan via email.
   - Masuk (Login) menggunakan JWT yang berlaku selama 7 hari.
   - Reset password aman menggunakan kode OTP 6-digit (valid 5 menit).
   - Fitur Deaktivasi Akun (Soft Delete) dan Reaktivasi Akun kembali.
2. **Manajemen Produk (CRUD)**:
   - Kelola katalog produk (tambah, baca, update, hapus).
   - Pencarian produk cepat menggunakan scan **Barcode**.
   - Pembaruan stok produk secara mandiri atau otomatis via transaksi.
3. **Sistem Transaksi Kasir**:
   - Pencatatan transaksi penjualan standar (menggunakan `product_id`).
   - Pencatatan transaksi cepat menggunakan daftar `barcode` (konsolidasi otomatis untuk mencegah redundansi stok).
   - Pengurangan stok otomatis secara *real-time* dengan transaksi atomik (`BEGIN`, `COMMIT`, `ROLLBACK`).
   - Geotagging otomatis (koordinat latitude & longitude) pada setiap transaksi.
   - Pilihan metode pembayaran: `cash`, `transfer`, `qris`.
4. **Analitik & Dashboard**:
   - Total omset penjualan hari ini dan bulan ini.
   - Total frekuensi transaksi.
   - Deteksi produk terlaris (*best-selling product*).
   - Jumlah produk dengan stok kritis (menipis di bawah 10 unit).
5. **Peta Panas Lokasi Penjualan (Heatmap)**:
   - Data koordinat penjualan yang dikelompokkan berdasarkan intensitas transaksi untuk visualisasi peta.
6. **Notifikasi Peringatan Stok (Stock Alerts)**:
   - Pembuatan alert otomatis ketika stok produk turun di bawah batas minimum (`min_stock`) saat transaksi terjadi.
   - Pencatatan lokasi geografis kejadian stok menipis.
   - Tandai alert sebagai sudah dibaca (`is_read = true`).

---

## 🛠️ Tech Stack & Ketergantungan

- **Runtime**: Node.js
- **Framework**: Express.js (v5.2.1)
- **Database**: PostgreSQL (pg client v8.20.0)
- **Otentikasi**: bcrypt (v6.0.0) & jsonwebtoken (v9.0.3)
- **Email Service**: nodemailer (v8.0.7)
- **Dokumentasi API**: swagger-ui-express & swagger-jsdoc
- **Development Tool**: nodemon (v3.1.14)

---

## 📝 Konfigurasi Environment (`.env`)

Buat berkas `.env` pada direktori root proyek dan isi parameter berikut:

```env
# Port server backend berjalan
PORT=5000

# URL Koneksi PostgreSQL (Supabase / Lokal)
DATABASE_URL=postgresql://username:password@host:port/database

# Kunci rahasia untuk enkripsi JWT Token
JWT_SECRET=rahasia_jwt_anda_yang_sangat_panjang_dan_aman

# Konfigurasi Pengiriman Email (Gmail App Password)
EMAIL_USER=email_anda@gmail.com
EMAIL_PASS=password_aplikasi_gmail_16_karakter

```

> [!TIP]
> Untuk mendapatkan `EMAIL_PASS`, Anda harus mengaktifkan *2-Step Verification* pada akun Google Anda, lalu buat password aplikasi khusus (*App Password*) dengan kategori **Mail**.

---

## 🗄️ Struktur Tabel Database (PostgreSQL DDL)

Silakan jalankan query SQL berikut pada DBMS PostgreSQL Anda (misalnya di SQL Editor Supabase atau pgAdmin) untuk membuat tabel yang dibutuhkan:

```sql
-- 1. Tabel Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    otp VARCHAR(255),
    otp_expires_at TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. Tabel Products
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    barcode VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    price INTEGER NOT NULL,
    stock INTEGER NOT NULL,
    min_stock INTEGER DEFAULT 5,
    image_url TEXT,
    category VARCHAR(255)
);

-- 3. Tabel Transactions
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    total_price INTEGER NOT NULL,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    payment_method VARCHAR(50) DEFAULT 'cash',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabel Transaction Items (Relasi Banyak-ke-Banyak)
CREATE TABLE transaction_items (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL,
    subtotal INTEGER NOT NULL
);

-- 5. Tabel Stock Alerts
CREATE TABLE stock_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    stock_at_alert INTEGER NOT NULL,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📦 Panduan Instalasi & Menjalankan Aplikasi

### Prerequisites
Pastikan Anda sudah menginstal **Node.js** dan **PostgreSQL** di komputer Anda.

### Langkah-langkah
1. **Clone repository ini** ke lokal Anda:
   ```bash
   git clone <repository_url>
   cd titikcuan-backend
   ```

2. **Instal seluruh dependensi**:
   ```bash
   npm install
   ```

3. **Siapkan Environment**:
   - Salin isi dari panduan konfigurasi ke file `.env` di root folder.
   - Sesuaikan konfigurasi database dan email dengan akun milik Anda.

4. **Jalankan dalam Mode Development**:
   ```bash
   npm run dev
   ```
   Server akan berjalan secara otomatis di port default: `http://localhost:5000` (atau sesuai konfigurasi `PORT` Anda).

---

## 📖 Dokumentasi API (Swagger OpenAPI)

API ini telah terintegrasi dengan **Swagger UI**, mempermudah pengujian endpoint langsung melalui browser.

* 🌐 **Swagger UI Web Interface**: 
  - URL Lokal: **[https://titik-cuan-api.vercel.app/api-docs/](https://titik-cuan-api.vercel.app/api-docs/)**
  - Tautan ini menyajikan visualisasi interaktif dari seluruh endpoint beserta skema request/response dan metode otentikasi JWT Bearer.
* 📄 **Swagger Raw JSON Schema**: 
  - URL Lokal: **[https://titik-cuan-api.vercel.app/swagger.json](https://titik-cuan-api.vercel.app/swagger.json)**
  - Tautan ini menyediakan spesifikasi OpenAPI dalam format raw JSON untuk diimpor ke aplikasi pengujian lain (seperti Postman atau Insomnia).

> [!IMPORTANT]
> Untuk endpoint yang membutuhkan otentikasi (ditandai dengan ikon gembok pada Swagger UI), lakukan login terlebih dahulu via `/auth/login` untuk mendapatkan JWT Token, kemudian klik tombol **Authorize** di pojok kanan atas Swagger UI, masukkan token dengan format: `Bearer <token_jwt_anda>`, lalu klik **Authorize**.

---

## 🛣️ Ringkasan Endpoint API

### 🔑 Authentication (`/auth`)
| Metode | Endpoint | Deskripsi | Otentikasi |
| :--- | :--- | :--- | :---: |
| **POST** | `/auth/register` | Mendaftarkan pengguna baru & kirim link verifikasi | ❌ |
| **POST** | `/auth/login` | Autentikasi user & mengembalikan token JWT | ❌ |
| **POST** | `/auth/forgot-password` | Meminta kode OTP untuk reset password via email | ❌ |
| **POST** | `/auth/reset-password` | Reset password menggunakan kode OTP 6-digit | ❌ |
| **POST** | `/auth/deactivate` | Menonaktifkan akun user (Soft Delete) | `Bearer Token` |
| **POST** | `/auth/reactivate` | Mengaktifkan kembali akun yang dinonaktifkan | ❌ |
| **GET** | `/auth/verify` | Tampilan verifikasi akun via link email | ❌ |
| **POST** | `/auth/logout` | Keluar dari sesi aplikasi | `Bearer Token` |

### 📦 Products (`/products`)
| Metode | Endpoint | Deskripsi | Otentikasi |
| :--- | :--- | :--- | :---: |
| **GET** | `/products` | Mengambil seluruh daftar produk milik user | `Bearer Token` |
| **POST** | `/products` | Menambahkan produk baru ke katalog | `Bearer Token` |
| **PUT** | `/products/:id` | Mengupdate seluruh detail produk tertentu | `Bearer Token` |
| **DELETE** | `/products/:id` | Menghapus produk dari katalog | `Bearer Token` |
| **GET** | `/products/barcode/:barcode` | Mencari detail produk menggunakan barcode | `Bearer Token` |
| **PATCH** | `/products/:id/stock` | Mengupdate stok produk saja | `Bearer Token` |

### 💸 Transactions (`/transactions`)
| Metode | Endpoint | Deskripsi | Otentikasi |
| :--- | :--- | :--- | :---: |
| **POST** | `/transactions` | Membuat transaksi baru dengan input `product_id` | `Bearer Token` |
| **GET** | `/transactions` | Mengambil riwayat semua transaksi milik user | `Bearer Token` |
| **GET** | `/transactions/:id` | Mengambil rincian detail item suatu transaksi | `Bearer Token` |
| **POST** | `/transactions/barcode` | Membuat transaksi baru dengan input daftar `barcode` | `Bearer Token` |

### 📊 Dashboard (`/dashboard`)
| Metode | Endpoint | Deskripsi | Otentikasi |
| :--- | :--- | :--- | :---: |
| **GET** | `/dashboard` | Mengambil ringkasan omset harian, bulanan, & stok menipis | `Bearer Token` |

### 🗺️ Heatmap (`/heatmap`)
| Metode | Endpoint | Deskripsi | Otentikasi |
| :--- | :--- | :--- | :---: |
| **GET** | `/heatmap` | Mengambil data intensitas penjualan per koordinat peta | `Bearer Token` |

### 🚨 Stock Alerts (`/stock-alerts`)
| Metode | Endpoint | Deskripsi | Otentikasi |
| :--- | :--- | :--- | :---: |
| **GET** | `/stock-alerts` | Mengambil daftar peringatan stok kritis yang belum dibaca | `Bearer Token` |
| **PATCH** | `/stock-alerts/:id/read` | Menandai peringatan stok tertentu telah dibaca | `Bearer Token` |
