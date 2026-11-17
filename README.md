# Backend Caku

REST API penyewaan perlengkapan camping **Caku**.
Dibangun dengan **Node.js + Express 5 + TypeScript + PostgreSQL**.

## Fitur

- Autentikasi JWT dengan dua role: `admin` dan `customer`
- Kategori read-only
- CRUD barang dengan upload gambar lokal
- Pengajuan penyewaan dengan upload bukti transfer
- Verifikasi dan perubahan status transaksi
- Proses pengembalian dengan perhitungan denda
- Laporan transaksi dan pendapatan

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
| Upload | Multer (penyimpanan lokal) |

## Menjalankan

1. Siapkan database PostgreSQL bernama `aplikasi_caku` menggunakan `database/schema.sql`.
2. Salin `.env.example` menjadi `.env` lalu sesuaikan kredensial database dan `JWT_SECRET`.
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

## Struktur

```
database/schema.sql        DDL acuan
docs/API.md               Dokumentasi endpoint
postman/                  Koleksi dan environment Postman
src/
  app.ts                  Konfigurasi Express
  server.ts               Entry point
  config/env.ts           Konfigurasi environment
  db/index.ts             Pool PostgreSQL + helper transaksi
  routes/                 Definisi route
  controllers/            Validasi request dan response
  services/               Query database dan aturan bisnis
  middlewares/            Auth, role, upload, error, 404
  validations/            Skema Zod
  utils/                  Uang, tanggal, file, token, error
  scripts/seed.ts         Seed data awal
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
- Stok dikembalikan saat `completed`.
