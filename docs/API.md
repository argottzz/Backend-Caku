# Dokumentasi API Caku

Backend REST API untuk sistem penyewaan perlengkapan camping **Caku**.
Dibangun dengan Node.js, Express 5, TypeScript, PostgreSQL, Zod, JWT, dan Multer.

- Base URL lokal: `http://localhost:8000`
- Semua endpoint aplikasi berada di bawah `/api`
- File unggahan disajikan dari `/uploads/...`

---

## 1. Menjalankan

```bash
npm install
npm run seed      # membuat 5 kategori + akun admin & customer
npm run dev       # server dengan watch
```

Perintah lain:

```bash
npm run typecheck
npm start
npm run seed
```

Akun seed (dapat diubah di `.env`):

| Role     | Email                | Password            |
| -------- | -------------------- | ------------------- |
| admin    | `admin@caku.test`    | `AdminCaku123!`     |
| customer | `customer@caku.test` | `CustomerCaku123!`  |

---

## 2. Format Response

Sukses:

```json
{ "success": true, "message": "...", "data": {} }
```

Sukses dengan daftar:

```json
{
  "success": true,
  "message": "...",
  "data": [],
  "pagination": { "page": 1, "limit": 10, "total": 25, "totalPages": 3 }
}
```

Gagal:

```json
{ "success": false, "message": "..." }
```

Gagal validasi menambahkan `error` berisi daftar masalah:

```json
{
  "success": false,
  "message": "Data tidak valid",
  "error": [{ "path": ["email"], "message": "Format email tidak valid" }]
}
```

Login dan register menambahkan `token` di level atas:

```json
{
  "success": true,
  "message": "Login berhasil",
  "data": { "id": 2, "nama": "Customer Caku", "email": "customer@caku.test", "role": "customer" },
  "token": "<jwt>"
}
```

---

## 3. Autentikasi dan Otorisasi

Endpoint privat membutuhkan header:

```
Authorization: Bearer <token>
```

| Kode | Makna |
| ---- | ----- |
| 401  | Token tidak ada / tidak valid / kadaluarsa |
| 403  | Role tidak diizinkan atau bukan pemilik data |

Role:

- `admin` — mengelola barang, memproses transaksi, memproses pengembalian, melihat laporan.
- `customer` — mengajukan penyewaan, melihat transaksi miliknya, membatalkan pengajuan `pending`.

---

## 4. Aturan Penting

### 4.1 Uang

- Disimpan sebagai `NUMERIC(12,2)`.
- Semua nilai uang pada response berupa **string dua desimal**, contoh `"75000.00"`.
- Perhitungan dilakukan dalam satuan sen (integer) agar tidak ada galat pembulatan.
- Field uang pada request menerima angka atau string, maksimal 2 angka desimal dan tidak boleh negatif.

### 4.2 Tanggal

- Format `YYYY-MM-DD`.
- Durasi sewa inklusif: `tanggal_selesai - tanggal_mulai + 1`.
- `tanggal_mulai` tidak boleh sebelum hari ini.
- `tanggal_selesai` tidak boleh sebelum `tanggal_mulai`.
- `tanggal_kembali_aktual` harus antara `tanggal_mulai` dan hari ini.

### 4.3 Unggahan File

- Field gambar barang: `image`.
- Field bukti transfer: `bukti_transfer`.
- Format: JPG, JPEG, PNG, WEBP.
- Ukuran maksimal: 5 MB.
- Nama file asli tidak dipakai; server menyimpan dengan UUID.
- Isi file divalidasi (magic bytes), bukan hanya ekstensi.
- Bukti transfer **wajib** saat mengajukan rental.

### 4.4 Siklus Status dan Stok

```
pending ──approve──> approved ──ongoing──> ongoing ──return──> completed
   │
   ├──reject──> rejected
   └──delete──> (baris dihapus)
```

| Aksi | Efek stok |
| ---- | --------- |
| Buat rental (`pending`) | Tidak berubah, hanya validasi ketersediaan |
| `approved` | Stok dikurangi |
| `ongoing` | Tidak berubah |
| `rejected` | Tidak berubah |
| `completed` | Stok dikembalikan |
| Batalkan `pending` | Tidak berubah |

Transisi status di luar diagram menghasilkan `409`.

### 4.5 Kondisi Pengembalian

`kondisi_pengembalian` bernilai `Baik`, `Rusak`, atau `Hilang`.

Database menyimpan satu kondisi per transaksi, sehingga:

- Semua stok detail dikembalikan saat `completed`.
- Kondisi hanya menjadi catatan.
- Jika kondisi bukan `Baik`, response menyertakan `perlu_penyesuaian_stok: true`.
- Admin menyesuaikan stok unit rusak/hilang melalui `PUT /api/items/:id`.

### 4.6 Denda

```
hari_terlambat = max(0, tanggal_kembali_aktual - tanggal_selesai)
total_denda    = Σ(jumlah × denda_perhari) × hari_terlambat
total_bayar    = total_sewa + total_denda
```

Harga dan denda disimpan sebagai snapshot di `rental_details`, sehingga perubahan harga barang tidak mengubah transaksi lama.

---

## 5. Endpoint

Ringkasan 16 endpoint:

| No | Method | Endpoint | Akses |
| -- | ------ | -------- | ----- |
| 1 | POST | `/api/auth/register` | Publik |
| 2 | POST | `/api/auth/login` | Publik |
| 3 | GET | `/api/auth/me` | Auth |
| 4 | GET | `/api/categories` | Auth |
| 5 | GET | `/api/items` | Auth |
| 6 | GET | `/api/items/:id` | Auth |
| 7 | POST | `/api/items` | Admin |
| 8 | PUT | `/api/items/:id` | Admin |
| 9 | DELETE | `/api/items/:id` | Admin |
| 10 | GET | `/api/rentals` | Auth |
| 11 | GET | `/api/rentals/:id` | Auth |
| 12 | POST | `/api/rentals` | Customer |
| 13 | DELETE | `/api/rentals/:id` | Customer |
| 14 | PATCH | `/api/rentals/:id/status` | Admin |
| 15 | POST | `/api/rentals/:id/return` | Admin |
| 16 | GET | `/api/reports/summary` | Admin |

---

### 5.1 POST `/api/auth/register`

Body JSON:

```json
{ "nama": "Budi", "email": "budi@example.com", "password": "Rahasia123" }
```

Validasi: `nama` 3–100 karakter, `email` valid dan unik, `password` 6–72 karakter.
Email dinormalisasi menjadi huruf kecil.

Response `201` + token. Email duplikat → `409`.

---

### 5.2 POST `/api/auth/login`

Body JSON:

```json
{ "email": "customer@caku.test", "password": "CustomerCaku123!" }
```

Response `200` + token. Kredensial salah → `401`.
Dibatasi 20 percobaan per 15 menit per IP.

---

### 5.3 GET `/api/auth/me`

Response `200`:

```json
{
  "success": true,
  "message": "Profil berhasil diambil",
  "data": { "id": 2, "nama": "Customer Caku", "email": "customer@caku.test", "role": "customer" }
}
```

---

### 5.4 GET `/api/categories`

Kategori bersifat read-only. Response `200` berisi daftar `{ id_kategori, nama }`.

---

### 5.5 GET `/api/items`

Query:

| Parameter | Keterangan |
| --------- | ---------- |
| `search` | Cari pada nama dan deskripsi (case-insensitive) |
| `id_kategori` | Filter kategori |
| `page` | Default 1 |
| `limit` | Default 10, maksimal 100 |

Response `200` + `pagination`. Setiap item berisi:

```json
{
  "id_items": 1,
  "id_kategori": 1,
  "nama_kategori": "Tenda dan Shelter",
  "nama_item": "Tenda Dome 4P",
  "deskripsi": "Tenda kapasitas 4 orang",
  "image": "/uploads/items/<uuid>.png",
  "image_url": "http://localhost:8000/uploads/items/<uuid>.png",
  "stok": 5,
  "harga_sewa_harian": "50000.00",
  "denda_harian": "10000.00",
  "created_at": "2026-11-17T10:00:00.000Z",
  "updated_at": "2026-11-17T10:00:00.000Z"
}
```

---

### 5.6 GET `/api/items/:id`

Response `200` detail item. Tidak ditemukan → `404`, id bukan angka → `400`.

---

### 5.7 POST `/api/items` (admin)

`multipart/form-data`:

| Field | Tipe | Wajib |
| ----- | ---- | ----- |
| `id_kategori` | text | ya |
| `nama_item` | text | ya |
| `deskripsi` | text | tidak |
| `stok` | text (integer ≥ 0) | ya |
| `harga_sewa_harian` | text (uang) | ya |
| `denda_harian` | text (uang) | ya |
| `image` | file | tidak |

Response `201`. Kategori tidak ada → `404`. File tidak valid → `400`.

---

### 5.8 PUT `/api/items/:id` (admin)

Full update: semua field wajib sama seperti create, `image` opsional.
Jika gambar baru diunggah, gambar lama dihapus **setelah** update database berhasil.

Response `200`. Tidak ditemukan → `404`.

---

### 5.9 DELETE `/api/items/:id` (admin)

Response `200`. Barang yang pernah dipakai rental tidak dapat dihapus → `409`.
File gambar dihapus setelah database berhasil.

---

### 5.10 GET `/api/rentals`

Customer hanya melihat rental miliknya; admin melihat semua.

Query: `status` (`pending|approved|ongoing|completed|rejected`), `page`, `limit`.

Response `200` + `pagination`. Ringkasan tiap rental:

```json
{
  "id_rental": 1,
  "id_user": 2,
  "nama_user": "Customer Caku",
  "email_user": "customer@caku.test",
  "tanggal_mulai": "2026-11-17",
  "tanggal_selesai": "2026-11-19",
  "tanggal_kembali_aktual": null,
  "durasi_hari": 3,
  "bukti_transfer": "/uploads/bukti-transfer/<uuid>.png",
  "bukti_transfer_url": "http://localhost:8000/uploads/bukti-transfer/<uuid>.png",
  "status": "pending",
  "kondisi_pengembalian": null,
  "catatan_pengembalian": null,
  "jumlah_item": 2,
  "total_sewa": "360000.00",
  "hari_terlambat": 0,
  "total_denda": "0.00",
  "total_bayar": "360000.00",
  "created_at": "2026-11-17T10:00:00.000Z"
}
```

---

### 5.11 GET `/api/rentals/:id`

Response `200` berisi ringkasan di atas ditambah `items`:

```json
{
  "id_detail_penyewaan": 1,
  "id_items": 1,
  "nama_item": "Tenda Dome 4P",
  "jumlah": 2,
  "harga_perhari": "50000.00",
  "denda_perhari": "10000.00",
  "subtotal": "300000.00"
}
```

Customer yang bukan pemilik → `403`.

---

### 5.12 POST `/api/rentals` (customer)

`multipart/form-data`:

| Field | Tipe | Wajib |
| ----- | ---- | ----- |
| `tanggal_mulai` | text | ya |
| `tanggal_selesai` | text | ya |
| `items` | text JSON | ya |
| `bukti_transfer` | file | ya |

Contoh `items`:

```json
[{ "id_items": 1, "jumlah": 2 }, { "id_items": 4, "jumlah": 1 }]
```

Aturan:

- Minimal 1 item, maksimal 50 jenis item.
- Item tidak boleh duplikat.
- Stok divalidasi; jumlah melebihi stok → `409`.
- Item tidak ditemukan → `400`.
- Bukti transfer tidak ada → `400`.

Response `201` berisi detail rental dan file bukti.

---

### 5.13 DELETE `/api/rentals/:id` (customer)

Menghapus permanen pengajuan berstatus `pending` milik sendiri.
Response `200`. Status bukan `pending` → `409`. Bukan pemilik → `403`.
File bukti transfer ikut dihapus setelah database berhasil.

---

### 5.14 PATCH `/api/rentals/:id/status` (admin)

Body JSON:

```json
{ "status": "approved" }
```

Nilai yang diterima: `approved`, `ongoing`, `rejected`.

| Dari | Ke | Syarat |
| ---- | -- | ------ |
| `pending` | `approved` | Stok divalidasi ulang lalu dikurangi |
| `pending` | `rejected` | — |
| `approved` | `ongoing` | — |

Transisi lain → `409`, termasuk approve dua kali.
Stok tidak mencukupi saat approve → `409` dan transaksi dibatalkan.

---

### 5.15 POST `/api/rentals/:id/return` (admin)

Body JSON:

```json
{
  "tanggal_kembali_aktual": "2026-11-20",
  "kondisi_pengembalian": "Baik",
  "catatan_pengembalian": "Dikembalikan lengkap"
}
```

Aturan:

- Rental harus berstatus `ongoing`, jika tidak → `409`.
- Tanggal harus valid, tidak melebihi hari ini, dan tidak sebelum `tanggal_mulai`.
- Semua stok detail dikembalikan.
- `perlu_penyesuaian_stok` bernilai `true` jika kondisi `Rusak`/`Hilang`.

Response `200` berisi detail rental `completed` + `perlu_penyesuaian_stok`.

---

### 5.16 GET `/api/reports/summary` (admin)

Query: `start_date`, `end_date` (berdasarkan `rentals.tanggal_mulai`), `status`, `page`, `limit`.

Response `200`:

```json
{
  "success": true,
  "message": "Ringkasan laporan berhasil diambil",
  "data": {
    "ringkasan": {
      "total_transaksi": 5,
      "transaksi_pending": 1,
      "transaksi_approved": 1,
      "transaksi_ongoing": 1,
      "transaksi_completed": 1,
      "transaksi_rejected": 1,
      "total_sewa": "750000.00",
      "total_denda": "20000.00",
      "total_pendapatan": "770000.00"
    },
    "rentals": []
  },
  "pagination": { "page": 1, "limit": 10, "total": 5, "totalPages": 1 }
}
```

Definisi:

- Pendapatan sewa dihitung dari transaksi `approved`, `ongoing`, dan `completed`.
- Denda hanya dihitung dari transaksi `completed` yang terlambat.
- `total_pendapatan = total_sewa + total_denda`.
- Transaksi `pending` dan `rejected` tidak menambah pendapatan.

---

## 6. Status Code

| Kode | Kapan |
| ---- | ----- |
| 200 | GET/PUT/PATCH/DELETE berhasil |
| 201 | POST berhasil membuat data |
| 400 | Validasi gagal, file tidak valid, tanggal tidak valid, item duplikat |
| 401 | Token tidak ada / tidak valid / kadaluarsa |
| 403 | Role tidak diizinkan / bukan pemilik |
| 404 | Data tidak ditemukan |
| 409 | Email duplikat, stok kurang, transisi status tidak sah, data masih dipakai |
| 500 | Kesalahan server |

---

## 7. Pengujian dengan Postman

1. Import `postman/Caku.postman_collection.json`.
2. Import `postman/Caku.postman_environment.json` lalu pilih environment **Caku Local**.
3. Jalankan server (`npm run dev`) dan seed (`npm run seed`).
4. Jalankan collection dengan Collection Runner sesuai urutan folder.

Koleksi menyimpan token dan id secara otomatis ke collection variable.
Fixture gambar tersedia di `postman/fixtures/`.
