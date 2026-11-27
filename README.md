# Backend Caku

REST API penyewaan perlengkapan camping **Caku**.
Dibangun dengan **Node.js + Express 5 + TypeScript + PostgreSQL**.

## Fitur

- Autentikasi JWT dengan dua role: `admin` dan `customer`
- CRUD kategori (khusus Admin; kategori yang masih dipakai barang tidak dapat dihapus)
- CRUD barang dengan upload gambar ke Cloudinary
- Foto profil customer dan admin (upload/ganti/hapus)
- Harga asli barang dan snapshot saat transaksi untuk penggantian barang hilang
- Pengajuan penyewaan dengan upload bukti transfer ke Cloudinary
- Verifikasi dan perubahan status transaksi
- Proses pengembalian dengan perhitungan denda dan pencatatan penggantian
- Laporan transaksi dan pendapatan
- Pengajuan menjadi admin oleh customer dan pemeriksaan oleh admin (tanpa tabel baru)

## Teknologi

| Komponen | Keterangan |
| -------- | ---------- |
| Runtime | Node.js 22+ |
| Bahasa | TypeScript (ESM, `tsx`) |
| Framework | Express 5 |
| Database | PostgreSQL |
| Driver | `pg` (`$1` placeholder, transaksi, `FOR UPDATE`) |
| Validasi | Zod |
| Auth | `jsonwebtoken` + `bcryptjs` |
| Upload | Multer + Cloudinary (penyimpanan cloud) |

## Menjalankan

1. Siapkan database PostgreSQL bernama `aplikasi_caku` menggunakan `database/schema.sql`.
   Untuk database yang sudah ada, jalankan migration di `database/migrations/` secara berurutan.
2. Salin `.env.example` menjadi `.env` lalu sesuaikan kredensial database, `JWT_SECRET`, dan `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`.
3. Jalankan:

```bash
npm install
npm run seed     # 5 kategori + akun admin & customer
npm run dev      # http://localhost:8000
```

Akun seed:

| Role | Email | Password |
| ---- | ----- | -------- |
| admin | `admin@caku.test` | `AdminCaku123!` |
| customer | `customer@caku.test` | `CustomerCaku123!` |

## Script

| Perintah | Fungsi |
| -------- | ------ |
| `npm run dev` | Server dengan watch |
| `npm start` | Server tanpa watch |
| `npm run typecheck` | Pemeriksaan tipe TypeScript |
| `npm run seed` | Seed kategori dan akun awal |
| `npm test` | Unit test validasi dan perhitungan penggantian |
| `npm run verify:features` | Verifikasi end-to-end DB + Cloudinary + HTTP (membuat lalu membersihkan data uji) |
| `npm run verify:categories` | Verifikasi end-to-end CRUD kategori DB + HTTP (membuat lalu membersihkan data uji) |

## Struktur

```
database/schema.sql        DDL acuan (termasuk kolom pengajuan admin, foto profil,
                           harga asli, snapshot, dan rental_replacements)
database/migrations/       Migration inkremental, idempotent
docs/API.md               Dokumentasi endpoint
postman/                  Koleksi dan environment Postman
tests/                    Unit test (node:test via tsx)
src/
  app.ts                  Konfigurasi Express
  server.ts               Entry point
  config/env.ts           Konfigurasi environment
  config/cloudinary.ts    Konfigurasi Cloudinary
  db/index.ts             Pool PostgreSQL + helper transaksi
  routes/                 Definisi route
  controllers/            Validasi request dan response
  services/               Query database dan aturan bisnis
  middlewares/            Auth, role, upload, error, 404
  validations/            Skema Zod
  utils/                  Uang, tanggal, file/Cloudinary, token, error
  scripts/seed.ts         Seed data awal
  scripts/verify-features.ts  Verifikasi end-to-end fitur baru
  scripts/verify-categories.ts  Verifikasi end-to-end CRUD kategori
```

## Dokumentasi API

Seluruh endpoint, format response, aturan bisnis, dan status code dijelaskan di
[`docs/API.md`](docs/API.md).

Pengujian manual dapat menggunakan koleksi Postman di `postman/`.

## Alur Status

```
pending ──approve──> approved ──ongoing──> ongoing ──return──> completed
   │
   ├──reject──> rejected
   └──delete──> dihapus
```

- Stok divalidasi saat pengajuan.
- Stok dikurangi saat `approved`.
- Stok dikembalikan saat `completed` dengan kondisi `Baik`/`Rusak`.
- Kondisi `Hilang` tidak mengembalikan stok dan mencatat kewajiban penggantian.

## Harga Asli dan Penggantian Barang Hilang

- `items.original_price` diisi Admin dan berbeda dari `harga_sewa_harian`.
- Barang tanpa `original_price` tidak dapat dipakai pada transaksi baru.
- Saat rental dibuat, `original_price` dibaca dari database dan disimpan sebagai
  snapshot `rental_details.original_price_at_rental` dalam transaksi yang sama.
- Kondisi `Hilang` menghitung
  `SUM(jumlah × original_price_at_rental)` dan menyimpannya di
  `rental_replacements` dengan status `Pending`.
- Admin menyelesaikan melalui `PATCH /api/rentals/:id/replacement`.
- Tidak ada pembayaran online; `Completed` hanya menandai status penyelesaian.

## Alur Pengajuan Admin

```
NULL ──ajukan──> pending ──approve──> approved (role admin)
                    │
                    └──reject──> rejected (role customer) ──ajukan ulang──> pending
```

- Disimpan pada kolom `admin_application_*` di tabel `users`; tidak ada tabel baru.
- Persetujuan dan penolakan menggunakan transaksi PostgreSQL + row locking.
- Role untuk otorisasi selalu dibaca dari database, bukan dari klaim JWT, sehingga
  perubahan role langsung berlaku pada sesi yang masih aktif.
