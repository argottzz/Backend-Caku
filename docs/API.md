# Dokumentasi API Caku

Backend REST API untuk sistem penyewaan perlengkapan camping **Caku**.
Dibangun dengan Node.js, Express 5, TypeScript, PostgreSQL, Zod, JWT, Multer, dan Cloudinary.

- Base URL lokal: `http://localhost:8000`
- Semua endpoint aplikasi berada di bawah `/api`
- Gambar disimpan di Cloudinary; response berisi URL `https://res.cloudinary.com/...`

---

## 1. Menjalankan

Isi `.env` (salin dari `.env.example`) termasuk:

```
DB_HOST=localhost
DB_PASS=...
JWT_SECRET=...

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

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

Untuk database yang sudah berjalan, perubahan struktur terbaru diterapkan dengan
`database/migrations/001_add_admin_application_columns.sql`. Migration bersifat
idempotent dan tidak membuat tabel baru.

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

- `admin` — mengelola barang, memproses transaksi, memproses pengembalian, melihat laporan, memeriksa pengajuan admin.
- `customer` — mengajukan penyewaan, melihat transaksi miliknya, membatalkan pengajuan `pending`, mengajukan perubahan role menjadi admin.

Role dan identitas pengguna selalu dibaca ulang dari tabel `users` pada setiap request.
Klaim `role` di dalam JWT tidak dipakai untuk otorisasi, sehingga:

- Perubahan role langsung berlaku pada token yang masih aktif.
- Token lama yang masih berisi `role: customer` tidak dapat mengakses endpoint admin
  setelah role di database berubah, dan sebaliknya token lama milik pengguna yang baru
  disetujui langsung memperoleh akses admin.
- Token milik pengguna yang sudah tidak ada di database ditolak dengan `401`.

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
- File disimpan ke **Cloudinary**, bukan ke disk server.
- Nama file asli tidak dipakai; `public_id` Cloudinary berupa UUID
  (`caku/items/<uuid>` atau `caku/bukti-transfer/<uuid>`).
- Isi file divalidasi (magic bytes), bukan hanya ekstensi.
- Bukti transfer **wajib** saat mengajukan rental.
- Kolom `image` dan `bukti_transfer` menyimpan **URL Cloudinary lengkap**.
  Field `image_url` dan `bukti_transfer_url` berisi URL yang sama.
- Saat gambar diganti atau barang dihapus, aset Cloudinary lama ikut dihapus
  setelah perubahan database berhasil. Jika database gagal, aset baru dibersihkan.

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

### 4.7 Pengajuan Menjadi Admin

Pengajuan disimpan pada tabel `users` (tanpa tabel terpisah). Satu pengguna hanya
memiliki status pengajuan terbaru.

```
NULL ──ajukan──> pending ──approve──> approved (role admin)
                    │
                    └──reject──> rejected (role customer) ──ajukan ulang──> pending
```

- Hanya `customer` yang dapat mengajukan.
- Pengajuan kedua saat status `pending` ditolak `409`.
- Mengajukan ulang hanya boleh dari status `rejected`; tanggal pengajuan diperbarui
  dan `admin_reviewed_at`, `admin_reviewed_by`, serta `admin_rejection_reason` dikosongkan.
- Approve/reject berjalan dalam satu transaksi PostgreSQL dengan `SELECT ... FOR UPDATE`,
  sehingga dua admin tidak dapat memproses pengajuan yang sama secara bersamaan.
- Approve mengubah `role` menjadi `admin` sekaligus status menjadi `approved`.
- Reject mempertahankan `role` `customer`, menyimpan status `rejected` dan alasan opsional.
- Pengajuan yang sudah diproses tidak dapat diproses ulang (`409`).

### 4.8 Kepemilikan Aset Gambar

- Hanya backend yang dapat mengunggah, mengganti, dan menghapus aset Cloudinary.
- Client tidak pernah mengirim URL atau `public_id` untuk disimpan/dihapus; field `image`
  pada body JSON diabaikan.
- Nama aset dibuat server: `caku/items/<uuid>` dan `caku/bukti-transfer/<uuid>`.
- Penggantian gambar item: unggah aset baru → simpan ke DB → hapus aset lama yang
  tercatat pada baris item tersebut.
- Penghapusan item: hapus baris → hapus aset yang tercatat pada baris tersebut.
- Pembatalan rental: hanya pemilik dan status `pending`; aset bukti transfer diambil
  dari baris rental, bukan dari request.
- Otorisasi (role/pemilik) diperiksa sebelum aksi; percobaan tanpa hak tidak menghapus aset.

---

## 5. Endpoint

Ringkasan 22 endpoint:

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
| 17 | POST | `/api/admin-applications` | Customer |
| 18 | GET | `/api/admin-applications/me` | Auth |
| 19 | GET | `/api/admin-applications` | Admin |
| 20 | GET | `/api/admin-applications/:id` | Admin |
| 21 | PATCH | `/api/admin-applications/:id/approve` | Admin |
| 22 | PATCH | `/api/admin-applications/:id/reject` | Admin |

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
  "image": "https://res.cloudinary.com/<cloud>/image/upload/v123/caku/items/<uuid>.png",
  "image_url": "https://res.cloudinary.com/<cloud>/image/upload/v123/caku/items/<uuid>.png",
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
  "bukti_transfer": "https://res.cloudinary.com/<cloud>/image/upload/v123/caku/bukti-transfer/<uuid>.png",
  "bukti_transfer_url": "https://res.cloudinary.com/<cloud>/image/upload/v123/caku/bukti-transfer/<uuid>.png",
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

### 5.17 POST `/api/admin-applications` (customer)

Membuat pengajuan menjadi admin. Tidak menerima body; identitas diambil dari JWT.

Digunakan untuk pengajuan pertama maupun pengajuan ulang setelah `rejected`.

Response `201`:

```json
{
  "success": true,
  "message": "Pengajuan menjadi admin berhasil dibuat",
  "data": {
    "id_user": 3,
    "nama": "Budi",
    "email": "budi@example.com",
    "role": "customer",
    "admin_application_status": "pending",
    "admin_application_date": "2026-11-19T10:00:00.000Z",
    "admin_reviewed_at": null,
    "admin_reviewed_by": null,
    "admin_rejection_reason": null,
    "admin_reviewer_nama": null
  }
}
```

Kemungkinan error:

- `403` — role bukan `customer` (sudah admin).
- `409` — pengajuan masih `pending`, atau pengajuan sudah `approved`.

---

### 5.18 GET `/api/admin-applications/me`

Status pengajuan milik pengguna yang sedang login.

Jika belum pernah mengajukan, response tetap `200` dengan
`admin_application_status: null` dan pesan
`"Anda belum pernah mengajukan menjadi admin"`.

---

### 5.19 GET `/api/admin-applications` (admin)

Query:

| Parameter | Keterangan |
| --------- | ---------- |
| `status` | `pending`, `approved`, atau `rejected` (opsional) |
| `page` | Default 1 |
| `limit` | Default 10, maksimal 100 |

Response `200` berisi daftar pengajuan dan `pagination`. Hanya pengguna yang memiliki
status pengajuan (tidak `NULL`) yang ditampilkan. `password_hash` tidak pernah dikirim.

---

### 5.20 GET `/api/admin-applications/:id` (admin)

`:id` adalah `users.id_user` pemohon, bukan id tabel pengajuan.

Response `200` berisi detail pengajuan. Pengguna tanpa pengajuan atau id tidak ada → `404`,
id bukan angka → `400`.

---

### 5.21 PATCH `/api/admin-applications/:id/approve` (admin)

Menyetujui pengajuan dalam satu transaksi PostgreSQL dengan row locking.

Efek:

- `users.role` → `admin`
- `admin_application_status` → `approved`
- `admin_reviewed_at` → waktu sekarang
- `admin_reviewed_by` → id admin dari JWT
- `admin_rejection_reason` → `NULL`

Response `200` berisi data pengajuan terbaru dengan `admin_reviewer_nama` terisi.

Error: `404` pengajuan tidak ada, `409` pengajuan sudah diproses / bukan `pending` /
pemohon bukan `customer`.

---

### 5.22 PATCH `/api/admin-applications/:id/reject` (admin)

Body JSON (opsional):

```json
{ "admin_rejection_reason": "Dokumen belum lengkap" }
```

Efek:

- `role` tetap `customer`
- `admin_application_status` → `rejected`
- `admin_reviewed_at` dan `admin_reviewed_by` diisi
- `admin_rejection_reason` disimpan bila dikirim, `NULL` bila tidak

Alasan maksimal 1000 karakter. Error mengikuti aturan approve (`404` / `409`).

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
| 409 | Email duplikat, stok kurang, transisi status tidak sah, data masih dipakai, pengajuan masih/sudah diproses |
| 500 | Kesalahan server |

---

## 7. Pengujian dengan Postman

1. Import `postman/Caku.postman_collection.json`.
2. Import `postman/Caku.postman_environment.json` lalu pilih environment **Caku Local**.
3. Jalankan server (`npm run dev`) dan seed (`npm run seed`).
4. Jalankan collection dengan Collection Runner sesuai urutan folder.

Koleksi menyimpan token dan id secara otomatis ke collection variable.
Fixture gambar tersedia di `postman/fixtures/`.

Folder **Pengajuan Admin** membuat akun pemohon baru, lalu menjalankan alur
ajukan → tolak → ajukan ulang → setujui sehingga akun seed tidak berubah role.
