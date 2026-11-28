/**
 * Verifikasi end-to-end fitur foto profil dan penggantian barang hilang.
 *
 * Script ini membuat data uji sementara (user, item, rental) pada database
 * yang dikonfigurasi di .env, memakai Cloudinary untuk unggahan nyata, lalu
 * membersihkan kembali data tersebut di akhir.
 *
 * Jalankan: npx tsx src/scripts/verify-features.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import app from "../app.ts";
import cloudinary from "../config/cloudinary.ts";
import pool from "../db/index.ts";
import { todayDateString } from "../utils/date.ts";
import {
  deleteCloudinaryByPublicId,
  deleteCloudinaryFile,
} from "../utils/file.ts";

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

interface ApiResult {
  status: number;
  body: any;
}

const results: CheckResult[] = [];

async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS - ${name}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, detail });
    console.log(`FAIL - ${name} (${detail})`);
  }
}

const server = app.listen(0, "127.0.0.1");

await new Promise<void>((resolveListen) => {
  if (server.listening) {
    resolveListen();
    return;
  }

  server.once("listening", () => resolveListen());
});

const address = server.address();
const baseUrl =
  typeof address === "object" && address
    ? `http://127.0.0.1:${address.port}`
    : "";

async function api(
  path: string,
  options: {
    method?: string;
    token?: string;
    json?: unknown;
    form?: FormData;
  } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = {};

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let body: BodyInit | undefined;

  if (options.form) {
    body = options.form;
  } else if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
  });

  const text = await response.text();
  let parsed: unknown = null;

  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  return { status: response.status, body: parsed };
}

function fixtureBlob(path: string, type = "image/png"): Blob {
  const buffer = readFileSync(resolve(process.cwd(), path));
  return new Blob([new Uint8Array(buffer)], { type });
}

function profileForm(extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.append(
    "profile_image",
    fixtureBlob("postman/fixtures/item.png"),
    "profile.png",
  );

  for (const [key, value] of Object.entries(extra)) {
    form.append(key, value);
  }

  return form;
}

function itemForm(input: {
  nama_item: string;
  stok?: number;
  original_price?: string;
  harga_sewa_harian?: string;
  denda_harian?: string;
}): FormData {
  const form = new FormData();
  form.append("id_kategori", String(categoryId));
  form.append("nama_item", input.nama_item);
  form.append("stok", String(input.stok ?? 5));
  form.append("harga_sewa_harian", input.harga_sewa_harian ?? "25000");
  form.append("denda_harian", input.denda_harian ?? "10000");

  if (input.original_price !== undefined) {
    form.append("original_price", input.original_price);
  }

  return form;
}

function rentalForm(
  items: Array<Record<string, unknown>>,
): FormData {
  const form = new FormData();
  const today = todayDateString();
  form.append("tanggal_mulai", today);
  form.append("tanggal_selesai", today);
  form.append("items", JSON.stringify(items));
  form.append(
    "bukti_transfer",
    fixtureBlob("postman/fixtures/bukti-transfer.png"),
    "bukti-transfer.png",
  );
  form.append(
    "identity_image",
    fixtureBlob("postman/fixtures/item.png"),
    "identity.png",
  );
  return form;
}

async function login(email: string, password: string): Promise<string> {
  const result = await api("/api/auth/login", {
    method: "POST",
    json: { email, password },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(typeof result.body.token, "string");
  return result.body.token as string;
}

async function stockOf(itemId: number): Promise<number> {
  const { rows } = await pool.query<{ stok: number }>(
    "SELECT stok FROM items WHERE id_items = $1",
    [itemId],
  );
  return rows[0].stok;
}

async function profileRow(userId: number) {
  const { rows } = await pool.query<{
    profile_image: string | null;
    profile_image_public_id: string | null;
  }>(
    `SELECT profile_image, profile_image_public_id
     FROM users
     WHERE id_user = $1`,
    [userId],
  );
  return rows[0];
}

async function countProfileAssets(): Promise<number> {
  const result = await cloudinary.api.resources({
    type: "upload",
    prefix: "caku/profile-images/",
    max_results: 100,
  });
  return (result.resources as unknown[]).length;
}

async function waitForProfileAssetCount(
  expected: number,
  attempts = 6,
): Promise<number> {
  let current = await countProfileAssets();

  for (let attempt = 1; attempt < attempts && current !== expected; attempt += 1) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
    current = await countProfileAssets();
  }

  return current;
}

let categoryId = 0;
const userIds: number[] = [];
const itemIds: number[] = [];
const rentalIds: number[] = [];
const proofUrls: string[] = [];

const stamp = Date.now();
const password = "TestCaku123!";

async function createUser(
  nama: string,
  email: string,
  role: "admin" | "customer",
): Promise<number> {
  const hash = await bcrypt.hash(password, 4);
  const { rows } = await pool.query<{ id_user: number }>(
    `INSERT INTO users (nama, email, password_hash, role)
     VALUES ($1, $2, $3, $4::role_type)
     RETURNING id_user`,
    [nama, email, hash, role],
  );
  userIds.push(rows[0].id_user);
  return rows[0].id_user;
}

async function main() {
  const categoryResult = await pool.query<{ id_kategori: number }>(
    "SELECT id_kategori FROM categories ORDER BY id_kategori LIMIT 1",
  );

  if (!categoryResult.rows[0]) {
    throw new Error("Tidak ada kategori. Jalankan npm run seed terlebih dahulu.");
  }

  categoryId = categoryResult.rows[0].id_kategori;

  const adminId = await createUser(
    "Test Admin",
    `test-admin-${stamp}@caku.test`,
    "admin",
  );
  const customerId = await createUser(
    "Test Customer",
    `test-customer-${stamp}@caku.test`,
    "customer",
  );
  const otherCustomerId = await createUser(
    "Test Customer Lain",
    `test-customer-lain-${stamp}@caku.test`,
    "customer",
  );

  const adminToken = await login(`test-admin-${stamp}@caku.test`, password);
  const customerToken = await login(
    `test-customer-${stamp}@caku.test`,
    password,
  );
  const otherToken = await login(
    `test-customer-lain-${stamp}@caku.test`,
    password,
  );

  // ================= FOTO PROFIL =================
  await check("Upload foto profil tanpa autentikasi ditolak 401", async () => {
    const result = await api("/api/users/me/profile-image", {
      method: "PATCH",
      form: profileForm(),
    });
    assert.equal(result.status, 401);
  });

  await check("Customer berhasil upload foto profil", async () => {
    const result = await api("/api/users/me/profile-image", {
      method: "PATCH",
      token: customerToken,
      form: profileForm(),
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.match(result.body.data.profile_image, /^https:\/\/res\.cloudinary\.com\//);
    assert.equal(result.body.data.id, customerId);

    const row = await profileRow(customerId);
    assert.ok(row.profile_image_public_id);
    assert.match(row.profile_image_public_id as string, /^caku\/profile-images\//);
  });

  await check("Admin berhasil upload foto profil", async () => {
    const result = await api("/api/users/me/profile-image", {
      method: "PATCH",
      token: adminToken,
      form: profileForm(),
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.data.id, adminId);
  });

  await check("Foto profil muncul pada GET /api/auth/me", async () => {
    const result = await api("/api/auth/me", { token: customerToken });
    assert.equal(result.status, 200);
    assert.ok(result.body.data.profile_image);
  });

  await check("Mengganti foto profil memakai public_id baru", async () => {
    const before = await profileRow(customerId);
    const result = await api("/api/users/me/profile-image", {
      method: "PATCH",
      token: customerToken,
      form: profileForm(),
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));

    const after = await profileRow(customerId);
    assert.notEqual(after.profile_image_public_id, before.profile_image_public_id);
    assert.notEqual(after.profile_image, before.profile_image);
  });

  await check("Body id_user diabaikan; foto akun lain tidak berubah", async () => {
    const result = await api("/api/users/me/profile-image", {
      method: "PATCH",
      token: customerToken,
      form: profileForm({ id_user: String(otherCustomerId) }),
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));

    const other = await profileRow(otherCustomerId);
    assert.equal(other.profile_image, null);
    assert.equal(other.profile_image_public_id, null);
  });

  await check(
    "Kegagalan database setelah upload mempertahankan foto lama dan membersihkan aset baru",
    async () => {
      const before = await profileRow(customerId);
      const assetCountBefore = await countProfileAssets();
      const functionName = `test_fail_profile_${stamp}`;
      const triggerName = `trg_${functionName}`;

      try {
        await pool.query(
          `CREATE OR REPLACE FUNCTION ${functionName}()
           RETURNS trigger AS $$
           BEGIN
             IF NEW.id_user = ${customerId}
                AND NEW.profile_image IS DISTINCT FROM OLD.profile_image THEN
               RAISE EXCEPTION 'simulated profile update failure';
             END IF;
             RETURN NEW;
           END;
           $$ LANGUAGE plpgsql`,
        );
        await pool.query(
          `CREATE TRIGGER ${triggerName}
           BEFORE UPDATE ON users
           FOR EACH ROW
           EXECUTE FUNCTION ${functionName}()`,
        );

        const result = await api("/api/users/me/profile-image", {
          method: "PATCH",
          token: customerToken,
          form: profileForm(),
        });
        assert.equal(result.status, 500, JSON.stringify(result.body));

        const after = await profileRow(customerId);
        assert.equal(after.profile_image, before.profile_image);
        assert.equal(
          after.profile_image_public_id,
          before.profile_image_public_id,
        );

        const assetCountAfter = await waitForProfileAssetCount(
          assetCountBefore,
        );
        assert.equal(assetCountAfter, assetCountBefore);
      } finally {
        await pool.query(`DROP TRIGGER IF EXISTS ${triggerName} ON users`);
        await pool.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
      }
    },
  );

  await check("File dengan isi bukan gambar ditolak 400", async () => {
    const form = new FormData();
    form.append(
      "profile_image",
      new Blob([new Uint8Array(Buffer.from("bukan gambar"))], {
        type: "image/png",
      }),
      "palsu.png",
    );

    const result = await api("/api/users/me/profile-image", {
      method: "PATCH",
      token: customerToken,
      form,
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
  });

  await check("File lebih dari 5 MB ditolak 400", async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 1);
    const form = new FormData();
    form.append(
      "profile_image",
      new Blob([new Uint8Array(big)], { type: "image/png" }),
      "besar.png",
    );

    const result = await api("/api/users/me/profile-image", {
      method: "PATCH",
      token: customerToken,
      form,
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
    assert.match(String(result.body.message), /5 MB/);
  });

  await check("Upload tanpa file ditolak 400", async () => {
    const result = await api("/api/users/me/profile-image", {
      method: "PATCH",
      token: customerToken,
      form: new FormData(),
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
  });

  await check("Menghapus foto profil berhasil dan aman diulang", async () => {
    const first = await api("/api/users/me/profile-image", {
      method: "DELETE",
      token: customerToken,
    });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.data.profile_image, null);

    const row = await profileRow(customerId);
    assert.equal(row.profile_image, null);
    assert.equal(row.profile_image_public_id, null);

    const second = await api("/api/users/me/profile-image", {
      method: "DELETE",
      token: customerToken,
    });
    assert.equal(second.status, 200, JSON.stringify(second.body));
  });

  // ================= HARGA ASLI =================
  await check("Customer tidak dapat membuat barang (403)", async () => {
    const result = await api("/api/items", {
      method: "POST",
      token: customerToken,
      form: itemForm({ nama_item: "Barang Ilegal", original_price: "1000" }),
    });
    assert.equal(result.status, 403);
  });

  await check("Harga asli negatif ditolak 400", async () => {
    const result = await api("/api/items", {
      method: "POST",
      token: adminToken,
      form: itemForm({ nama_item: "Negatif", original_price: "-1" }),
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
  });

  await check("Harga asli tidak valid ditolak 400", async () => {
    const result = await api("/api/items", {
      method: "POST",
      token: adminToken,
      form: itemForm({ nama_item: "Tidak Valid", original_price: "abc" }),
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
  });

  let itemA = 0;
  let itemB = 0;
  let itemC = 0;

  await check("Admin membuat barang dengan harga asli", async () => {
    const result = await api("/api/items", {
      method: "POST",
      token: adminToken,
      form: itemForm({ nama_item: "Tenda Uji", original_price: "500000" }),
    });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.data.original_price, "500000.00");
    itemA = result.body.data.id_items;
    itemIds.push(itemA);
  });

  await check("Admin membuat barang kedua dengan harga asli", async () => {
    const result = await api("/api/items", {
      method: "POST",
      token: adminToken,
      form: itemForm({ nama_item: "Sleeping Bag Uji", original_price: "150000" }),
    });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.data.original_price, "150000.00");
    itemB = result.body.data.id_items;
    itemIds.push(itemB);
  });

  await check("Barang tanpa harga asli tetap dapat dibuat (NULL)", async () => {
    const result = await api("/api/items", {
      method: "POST",
      token: adminToken,
      form: itemForm({ nama_item: "Barang Lama Uji" }),
    });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.data.original_price, null);
    itemC = result.body.data.id_items;
    itemIds.push(itemC);
  });

  await check("Harga asli muncul pada daftar dan detail barang", async () => {
    const list = await api("/api/items?limit=100", { token: adminToken });
    assert.equal(list.status, 200);
    const found = list.body.data.find(
      (item: { id_items: number }) => item.id_items === itemA,
    );
    assert.equal(found.original_price, "500000.00");

    const detail = await api(`/api/items/${itemA}`, { token: adminToken });
    assert.equal(detail.body.data.original_price, "500000.00");
  });

  await check("Admin memperbarui harga asli", async () => {
    const result = await api(`/api/items/${itemA}`, {
      method: "PUT",
      token: adminToken,
      form: itemForm({
        nama_item: "Tenda Uji",
        original_price: "600000",
      }),
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.data.original_price, "600000.00");
  });

  // ================= SNAPSHOT & PENGEMBALIAN =================
  let lostRentalId = 0;

  await check("Rental dengan barang tanpa harga asli ditolak 409", async () => {
    const result = await api("/api/rentals", {
      method: "POST",
      token: customerToken,
      form: rentalForm([{ id_items: itemC, jumlah: 1 }]),
    });
    assert.equal(result.status, 409, JSON.stringify(result.body));
    assert.match(String(result.body.message), /Harga asli/);
  });

  await check("Snapshot harga asli dibuat dari database, bukan request", async () => {
    // Harga item A sudah menjadi 600000, tetapi rental harus memakai nilai
    // saat transaksi dibuat. Kirim original_price palsu dari request.
    const result = await api("/api/rentals", {
      method: "POST",
      token: customerToken,
      form: rentalForm([
        { id_items: itemA, jumlah: 1, original_price: 1 },
        { id_items: itemB, jumlah: 2, original_price: 1 },
      ]),
    });

    assert.equal(result.status, 201, JSON.stringify(result.body));
    lostRentalId = result.body.data.id_rental;
    rentalIds.push(lostRentalId);
    proofUrls.push(result.body.data.bukti_transfer);

    const items = result.body.data.items as Array<{
      id_items: number;
      original_price_at_rental: string | null;
    }>;
    const a = items.find((item) => item.id_items === itemA);
    const b = items.find((item) => item.id_items === itemB);

    assert.equal(a?.original_price_at_rental, "600000.00");
    assert.equal(b?.original_price_at_rental, "150000.00");

    const { rows } = await pool.query<{
      id_items: number;
      original_price_at_rental: string;
    }>(
      `SELECT id_items, original_price_at_rental
       FROM rental_details
       WHERE id_rental = $1
       ORDER BY id_items`,
      [lostRentalId],
    );
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.original_price_at_rental !== null));
  });

  await check("Snapshot tidak berubah saat harga barang diubah", async () => {
    const update = await api(`/api/items/${itemA}`, {
      method: "PUT",
      token: adminToken,
      form: itemForm({
        nama_item: "Tenda Uji",
        original_price: "900000",
      }),
    });
    assert.equal(update.status, 200, JSON.stringify(update.body));

    const detail = await api(`/api/rentals/${lostRentalId}`, {
      token: adminToken,
    });
    const a = (detail.body.data.items as Array<{
      id_items: number;
      original_price_at_rental: string;
    }>).find((item) => item.id_items === itemA);

    assert.equal(a?.original_price_at_rental, "600000.00");
  });

  await check("Approve dan mulai rental", async () => {
    const approve = await api(`/api/rentals/${lostRentalId}/status`, {
      method: "PATCH",
      token: adminToken,
      json: { status: "approved" },
    });
    assert.equal(approve.status, 200, JSON.stringify(approve.body));

    const start = await api(`/api/rentals/${lostRentalId}/status`, {
      method: "PATCH",
      token: adminToken,
      json: { status: "ongoing" },
    });
    assert.equal(start.status, 200, JSON.stringify(start.body));

    assert.equal(await stockOf(itemA), 4);
    assert.equal(await stockOf(itemB), 3);
  });

  await check("Pengembalian Hilang menghitung total dari snapshot", async () => {
    const result = await api(`/api/rentals/${lostRentalId}/return`, {
      method: "POST",
      token: adminToken,
      json: {
        tanggal_kembali_aktual: todayDateString(),
        kondisi_pengembalian: "Hilang",
      },
    });

    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.data.penggantian.total_amount, "900000.00");
    assert.equal(result.body.data.penggantian.status, "Pending");
    assert.equal(result.body.data.penggantian.recorded_by, adminId);
    assert.equal(result.body.data.penggantian_perlu_ditinjau, false);
  });

  await check("Stok barang hilang tidak dikembalikan", async () => {
    assert.equal(await stockOf(itemA), 4);
    assert.equal(await stockOf(itemB), 3);
  });

  await check("Pengembalian kedua ditolak dan penggantian tidak duplikat", async () => {
    const second = await api(`/api/rentals/${lostRentalId}/return`, {
      method: "POST",
      token: adminToken,
      json: {
        tanggal_kembali_aktual: todayDateString(),
        kondisi_pengembalian: "Hilang",
      },
    });
    assert.equal(second.status, 409);

    const { rows } = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM rental_replacements
       WHERE id_rental = $1`,
      [lostRentalId],
    );
    assert.equal(rows[0].total, 1);
  });

  await check("Customer tidak dapat menyelesaikan penggantian (403)", async () => {
    const result = await api(`/api/rentals/${lostRentalId}/replacement`, {
      method: "PATCH",
      token: customerToken,
      json: { status: "Completed" },
    });
    assert.equal(result.status, 403);
  });

  await check("Customer hanya dapat melihat penggantian rental miliknya", async () => {
    const own = await api(`/api/rentals/${lostRentalId}`, {
      token: customerToken,
    });
    assert.equal(own.status, 200);
    assert.equal(own.body.data.penggantian.total_amount, "900000.00");

    const other = await api(`/api/rentals/${lostRentalId}`, {
      token: otherToken,
    });
    assert.equal(other.status, 403);
  });

  await check("Admin menyelesaikan penggantian tanpa mengubah nominal", async () => {
    const result = await api(`/api/rentals/${lostRentalId}/replacement`, {
      method: "PATCH",
      token: adminToken,
      json: { status: "Completed", total_amount: "1" },
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.data.status, "Completed");
    assert.equal(result.body.data.total_amount, "900000.00");
    assert.equal(result.body.data.completed_by, adminId);
    assert.ok(result.body.data.completed_at);
  });

  await check("Pengembalian Baik tidak membuat kewajiban penggantian", async () => {
    const create = await api("/api/rentals", {
      method: "POST",
      token: customerToken,
      form: rentalForm([{ id_items: itemA, jumlah: 1 }]),
    });
    assert.equal(create.status, 201, JSON.stringify(create.body));
    const rentalId = create.body.data.id_rental;
    rentalIds.push(rentalId);
    proofUrls.push(create.body.data.bukti_transfer);

    const stockBefore = await stockOf(itemA);

    const approve = await api(`/api/rentals/${rentalId}/status`, {
      method: "PATCH",
      token: adminToken,
      json: { status: "approved" },
    });
    assert.equal(approve.status, 200, JSON.stringify(approve.body));

    const start = await api(`/api/rentals/${rentalId}/status`, {
      method: "PATCH",
      token: adminToken,
      json: { status: "ongoing" },
    });
    assert.equal(start.status, 200, JSON.stringify(start.body));

    const returned = await api(`/api/rentals/${rentalId}/return`, {
      method: "POST",
      token: adminToken,
      json: {
        tanggal_kembali_aktual: todayDateString(),
        kondisi_pengembalian: "Baik",
      },
    });
    assert.equal(returned.status, 200, JSON.stringify(returned.body));
    assert.equal(returned.body.data.penggantian, null);
    assert.equal(await stockOf(itemA), stockBefore);

    const { rows } = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM rental_replacements
       WHERE id_rental = $1`,
      [rentalId],
    );
    assert.equal(rows[0].total, 0);
  });

  await check(
    "Data lama tanpa snapshot ditandai untuk ditinjau tanpa memakai harga terbaru",
    async () => {
      const create = await api("/api/rentals", {
        method: "POST",
        token: customerToken,
        form: rentalForm([{ id_items: itemA, jumlah: 1 }]),
      });
      assert.equal(create.status, 201, JSON.stringify(create.body));
      const rentalId = create.body.data.id_rental;
      rentalIds.push(rentalId);
      proofUrls.push(create.body.data.bukti_transfer);

      const approve = await api(`/api/rentals/${rentalId}/status`, {
        method: "PATCH",
        token: adminToken,
        json: { status: "approved" },
      });
      assert.equal(approve.status, 200, JSON.stringify(approve.body));

      const start = await api(`/api/rentals/${rentalId}/status`, {
        method: "PATCH",
        token: adminToken,
        json: { status: "ongoing" },
      });
      assert.equal(start.status, 200, JSON.stringify(start.body));

      // Simulasikan data lama yang belum memiliki snapshot.
      await pool.query(
        `UPDATE rental_details
         SET original_price_at_rental = NULL
         WHERE id_rental = $1`,
        [rentalId],
      );

      const returned = await api(`/api/rentals/${rentalId}/return`, {
        method: "POST",
        token: adminToken,
        json: {
          tanggal_kembali_aktual: todayDateString(),
          kondisi_pengembalian: "Hilang",
        },
      });

      assert.equal(returned.status, 200, JSON.stringify(returned.body));
      assert.equal(returned.body.data.penggantian, null);
      assert.equal(returned.body.data.penggantian_perlu_ditinjau, true);
      assert.equal(returned.body.data.item_tanpa_harga_asli.length, 1);
      assert.equal(
        returned.body.data.item_tanpa_harga_asli[0].id_items,
        itemA,
      );

      const { rows } = await pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM rental_replacements
         WHERE id_rental = $1`,
        [rentalId],
      );
      assert.equal(rows[0].total, 0);
    },
  );

  await check("Checkout tanpa bukti_transfer ditolak 400", async () => {
    const form = new FormData();
    const today = todayDateString();
    form.append("tanggal_mulai", today);
    form.append("tanggal_selesai", today);
    form.append("items", JSON.stringify([{ id_items: itemA, jumlah: 1 }]));
    form.append(
      "identity_image",
      fixtureBlob("postman/fixtures/item.png"),
      "identity.png",
    );

    const result = await api("/api/rentals", {
      method: "POST",
      token: customerToken,
      form,
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
    assert.match(String(result.body.message), /Bukti transfer/);
  });

  await check("Checkout tanpa identity_image ditolak 400", async () => {
    const form = new FormData();
    const today = todayDateString();
    form.append("tanggal_mulai", today);
    form.append("tanggal_selesai", today);
    form.append("items", JSON.stringify([{ id_items: itemA, jumlah: 1 }]));
    form.append(
      "bukti_transfer",
      fixtureBlob("postman/fixtures/bukti-transfer.png"),
      "bukti-transfer.png",
    );

    const result = await api("/api/rentals", {
      method: "POST",
      token: customerToken,
      form,
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
    assert.match(String(result.body.message), /KTP/);
  });

  let identityRentalId = 0;
  await check("Checkout dengan kedua file valid menyimpan foto KTP", async () => {
    const result = await api("/api/rentals", {
      method: "POST",
      token: customerToken,
      form: rentalForm([{ id_items: itemA, jumlah: 1 }]),
    });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    identityRentalId = result.body.data.id_rental;
    rentalIds.push(identityRentalId);
    proofUrls.push(result.body.data.bukti_transfer);
    proofUrls.push(result.body.data.identity_image);

    assert.match(
      String(result.body.data.identity_image),
      /^https:\/\/res\.cloudinary\.com\//,
    );
  });

  await check("Detail rental mengembalikan identity_image", async () => {
    const result = await api(`/api/rentals/${identityRentalId}`, {
      token: adminToken,
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.ok(result.body.data.identity_image);
    assert.equal(
      result.body.data.identity_image_public_id,
      undefined,
      "public_id tidak boleh dikirim ke client",
    );
  });

  await check("Registrasi tanpa nomor telepon ditolak 400", async () => {
    const result = await api("/api/auth/register", {
      method: "POST",
      json: {
        nama: "No Phone User",
        email: `no-phone-${stamp}@caku.test`,
        password: password,
      },
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
  });

  await check("Registrasi dengan nomor telepon valid berhasil", async () => {
    const result = await api("/api/auth/register", {
      method: "POST",
      json: {
        nama: "Phone User",
        email: `phone-${stamp}@caku.test`,
        phone_number: `0812${String(stamp).slice(-8)}`.slice(0, 12),
        password,
      },
    });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(typeof result.body.data.phone_number, "string");
    userIds.push(result.body.data.id);
  });

  await check("GET /api/auth/me mengembalikan phone_number", async () => {
    const result = await api("/api/auth/me", { token: customerToken });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.data.phone_number, null);
  });

  await check("Customer dapat menambahkan nomor telepon via PATCH /api/users/me", async () => {
    const result = await api("/api/users/me", {
      method: "PATCH",
      token: customerToken,
      json: { phone_number: "089999999999" },
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.data.phone_number, "089999999999");
  });

  await check("Ubah kata sandi dengan data valid berhasil", async () => {
    const result = await api("/api/auth/change-password", {
      method: "PATCH",
      token: customerToken,
      json: {
        current_password: password,
        new_password: "NewPass123!",
        confirm_password: "NewPass123!",
      },
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
  });

  await check("Password baru dapat digunakan untuk login", async () => {
    const token = await login(`test-customer-${stamp}@caku.test`, "NewPass123!");
    assert.equal(typeof token, "string");
  });

  await check("Password lama salah ditolak", async () => {
    const result = await api("/api/auth/change-password", {
      method: "PATCH",
      token: customerToken,
      json: {
        current_password: "salah",
        new_password: "AnotherPass1!",
        confirm_password: "AnotherPass1!",
      },
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
  });

  await check("Konfirmasi password tidak cocok ditolak", async () => {
    const result = await api("/api/auth/change-password", {
      method: "PATCH",
      token: customerToken,
      json: {
        current_password: "NewPass123!",
        new_password: "AnotherPass1!",
        confirm_password: "BedaPass1!",
      },
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
  });

  await check("Request change-password tanpa JWT ditolak", async () => {
    const result = await api("/api/auth/change-password", {
      method: "PATCH",
      json: {
        current_password: "x",
        new_password: "y",
        confirm_password: "y",
      },
    });
    assert.equal(result.status, 401);
  });

  await check("Checkout dengan metode QR (tanpa bukti transfer) berhasil", async () => {
    const form = new FormData();
    const today = todayDateString();
    form.append("tanggal_mulai", today);
    form.append("tanggal_selesai", today);
    form.append("metode_pembayaran", "qr_code");
    form.append("items", JSON.stringify([{ id_items: itemA, jumlah: 1 }]));
    form.append(
      "identity_image",
      fixtureBlob("postman/fixtures/item.png"),
      "identity.png",
    );

    const result = await api("/api/rentals", {
      method: "POST",
      token: customerToken,
      form,
    });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.data.status, "awaiting_payment");
    assert.equal(result.body.data.metode_pembayaran, "qr_code");
    assert.match(String(result.body.data.qr_code_payload), /^CAKU-PAY-/);

    const qrRentalId = result.body.data.id_rental;
    rentalIds.push(qrRentalId);
    proofUrls.push(result.body.data.identity_image);

    const payload = result.body.data.qr_code_payload as string;

    const pay = await api("/api/rentals/pay-qr", {
      method: "POST",
      token: customerToken,
      json: { qr_code_payload: payload },
    });
    assert.equal(pay.status, 200, JSON.stringify(pay.body));
    assert.equal(pay.body.data.status, "pending");
    assert.ok(pay.body.data.paid_at);

    const second = await api("/api/rentals/pay-qr", {
      method: "POST",
      token: customerToken,
      json: { qr_code_payload: payload },
    });
    assert.equal(second.status, 400, JSON.stringify(second.body));

    const invalid = await api("/api/rentals/pay-qr", {
      method: "POST",
      token: customerToken,
      json: { qr_code_payload: "CAKU-PAY-999999-0" },
    });
    assert.equal(invalid.status, 404, JSON.stringify(invalid.body));
  });

  await check("Admin dapat menghapus foto profil sendiri", async () => {
    const result = await api("/api/users/me/profile-image", {
      method: "DELETE",
      token: adminToken,
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.data.profile_image, null);
  });
}

try {
  await main();
} catch (error) {
  console.error("Verifikasi berhenti:", error);
  process.exitCode = 1;
} finally {
  // Bersihkan aset foto profil yang masih tersisa.
  for (const userId of userIds) {
    const row = await profileRow(userId).catch(() => undefined);

    if (row?.profile_image_public_id) {
      await deleteCloudinaryByPublicId(row.profile_image_public_id);
    } else if (row?.profile_image) {
      await deleteCloudinaryFile(row.profile_image);
    }
  }

  if (rentalIds.length > 0) {
    await pool
      .query("DELETE FROM rental_replacements WHERE id_rental = ANY($1::int[])", [
        rentalIds,
      ])
      .catch(() => undefined);
    await pool
      .query("DELETE FROM rentals WHERE id_rental = ANY($1::int[])", [rentalIds])
      .catch(() => undefined);
  }

  if (itemIds.length > 0) {
    await pool
      .query("DELETE FROM items WHERE id_items = ANY($1::int[])", [itemIds])
      .catch(() => undefined);
  }

  if (userIds.length > 0) {
    await pool
      .query("DELETE FROM users WHERE id_user = ANY($1::int[])", [userIds])
      .catch(() => undefined);
  }

  for (const url of proofUrls) {
    await deleteCloudinaryFile(url);
  }

  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  await pool.end();

  const failed = results.filter((result) => !result.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} pemeriksaan berhasil`,
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}
