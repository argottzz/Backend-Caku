/**
 * Verifikasi end-to-end CRUD kategori.
 *
 * Script ini membuat admin & customer sementara, menguji seluruh endpoint
 * kategori melalui HTTP, lalu membersihkan data uji. Tidak menyentuh tabel
 * maupun kolom database: hanya baris data uji yang dibuat dan dihapus lagi.
 *
 * Jalankan: npx tsx src/scripts/verify-categories.ts
 */
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import app from "../app.ts";
import pool from "../db/index.ts";

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

async function login(email: string, password: string): Promise<string> {
  const result = await api("/api/auth/login", {
    method: "POST",
    json: { email, password },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(typeof result.body.token, "string");
  return result.body.token as string;
}

const stamp = Date.now();
const password = "TestCaku123!";
const userIds: number[] = [];
const categoryIds: number[] = [];
const itemIds: number[] = [];

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

async function categoryNames(): Promise<string[]> {
  const { rows } = await pool.query<{ nama: string }>(
    "SELECT nama FROM categories ORDER BY id_kategori",
  );
  return rows.map((row) => row.nama);
}

async function main() {
  await createUser("Test Admin Kategori", `cat-admin-${stamp}@caku.test`, "admin");
  await createUser(
    "Test Customer Kategori",
    `cat-customer-${stamp}@caku.test`,
    "customer",
  );

  const adminToken = await login(`cat-admin-${stamp}@caku.test`, password);
  const customerToken = await login(
    `cat-customer-${stamp}@caku.test`,
    password,
  );

  const uniqueName = `Kategori Uji ${stamp}`;

  // ================= AUTENTIKASI & OTORISASI =================
  await check("GET /api/categories tanpa token ditolak 401", async () => {
    const result = await api("/api/categories");
    assert.equal(result.status, 401, JSON.stringify(result.body));
  });

  await check("Customer tidak dapat menambah kategori (403)", async () => {
    const result = await api("/api/categories", {
      method: "POST",
      token: customerToken,
      json: { nama: `Kategori Customer ${stamp}` },
    });
    assert.equal(result.status, 403, JSON.stringify(result.body));
  });

  await check("Customer tidak dapat mengubah kategori (403)", async () => {
    const result = await api("/api/categories/1", {
      method: "PATCH",
      token: customerToken,
      json: { nama: "Diubah Customer" },
    });
    assert.equal(result.status, 403, JSON.stringify(result.body));
  });

  await check("Customer tidak dapat menghapus kategori (403)", async () => {
    const result = await api("/api/categories/1", {
      method: "DELETE",
      token: customerToken,
    });
    assert.equal(result.status, 403, JSON.stringify(result.body));
  });

  await check("Customer tetap dapat membaca daftar kategori", async () => {
    const result = await api("/api/categories", { token: customerToken });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.ok(Array.isArray(result.body.data));
  });

  // ================= CREATE =================
  let createdId = 0;

  await check("Admin menambah kategori dengan nama valid (201)", async () => {
    const result = await api("/api/categories", {
      method: "POST",
      token: adminToken,
      json: { nama: `  ${uniqueName}  ` },
    });

    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.data.nama, uniqueName, "nama harus di-trim");
    assert.equal(typeof result.body.data.id_kategori, "number");

    createdId = result.body.data.id_kategori;
    categoryIds.push(createdId);
  });

  await check("Kategori tersimpan di database", async () => {
    const { rows } = await pool.query<{ nama: string }>(
      "SELECT nama FROM categories WHERE id_kategori = $1",
      [createdId],
    );
    assert.equal(rows[0]?.nama, uniqueName);
  });

  await check("Nama kategori kosong ditolak 400", async () => {
    const result = await api("/api/categories", {
      method: "POST",
      token: adminToken,
      json: { nama: "" },
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
  });

  await check("Nama kategori hanya spasi ditolak 400", async () => {
    const result = await api("/api/categories", {
      method: "POST",
      token: adminToken,
      json: { nama: "     " },
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
  });

  await check("Nama kategori tanpa field nama ditolak 400", async () => {
    const result = await api("/api/categories", {
      method: "POST",
      token: adminToken,
      json: {},
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
  });

  await check("Nama kategori duplikat ditolak 409", async () => {
    const result = await api("/api/categories", {
      method: "POST",
      token: adminToken,
      json: { nama: uniqueName },
    });
    assert.equal(result.status, 409, JSON.stringify(result.body));

    const names = await categoryNames();
    assert.equal(
      names.filter((nama) => nama === uniqueName).length,
      1,
      "hanya boleh ada satu baris dengan nama tersebut",
    );
  });

  // ================= READ =================
  await check("GET /api/categories memuat kategori baru", async () => {
    const result = await api("/api/categories", { token: adminToken });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.ok(Array.isArray(result.body.data));

    const found = result.body.data.find(
      (row: { id_kategori: number }) => row.id_kategori === createdId,
    );
    assert.equal(found?.nama, uniqueName);
    assert.equal(typeof found?.id_kategori, "number");
  });

  // ================= UPDATE =================
  const updatedName = `${uniqueName} Diubah`;

  await check("Admin mengubah nama kategori (200)", async () => {
    const result = await api(`/api/categories/${createdId}`, {
      method: "PATCH",
      token: adminToken,
      json: { nama: `  ${updatedName}  ` },
    });

    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.data.nama, updatedName);
    assert.equal(result.body.data.id_kategori, createdId);
  });

  await check("Perubahan nama tercermin pada daftar kategori", async () => {
    const result = await api("/api/categories", { token: adminToken });
    const found = result.body.data.find(
      (row: { id_kategori: number }) => row.id_kategori === createdId,
    );
    assert.equal(found?.nama, updatedName);
  });

  await check("Perubahan nama kosong ditolak 400", async () => {
    const result = await api(`/api/categories/${createdId}`, {
      method: "PATCH",
      token: adminToken,
      json: { nama: "   " },
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
  });

  await check("Ubah ke nama yang sudah dipakai ditolak 409", async () => {
    const other = await api("/api/categories", {
      method: "POST",
      token: adminToken,
      json: { nama: `Kategori Lain ${stamp}` },
    });
    assert.equal(other.status, 201, JSON.stringify(other.body));
    categoryIds.push(other.body.data.id_kategori);

    const result = await api(`/api/categories/${createdId}`, {
      method: "PATCH",
      token: adminToken,
      json: { nama: `Kategori Lain ${stamp}` },
    });
    assert.equal(result.status, 409, JSON.stringify(result.body));
  });

  await check("Ubah kategori dengan ID tidak ditemukan 404", async () => {
    const result = await api("/api/categories/999999999", {
      method: "PATCH",
      token: adminToken,
      json: { nama: "Kategori Hantu" },
    });
    assert.equal(result.status, 404, JSON.stringify(result.body));
  });

  await check("Ubah kategori dengan ID bukan angka ditolak 400", async () => {
    const result = await api("/api/categories/abc", {
      method: "PATCH",
      token: adminToken,
      json: { nama: "Kategori Hantu" },
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
  });

  // ================= DELETE =================
  let unusedId = 0;

  await check("Admin menghapus kategori yang tidak dipakai barang (200)", async () => {
    const create = await api("/api/categories", {
      method: "POST",
      token: adminToken,
      json: { nama: `Kategori Tanpa Barang ${stamp}` },
    });
    assert.equal(create.status, 201, JSON.stringify(create.body));
    unusedId = create.body.data.id_kategori;

    const result = await api(`/api/categories/${unusedId}`, {
      method: "DELETE",
      token: adminToken,
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.data.id_kategori, unusedId);

    const names = await categoryNames();
    assert.equal(
      names.includes(`Kategori Tanpa Barang ${stamp}`),
      false,
      "kategori harus hilang dari database",
    );
  });

  await check("Kategori yang dihapus tidak ada lagi pada daftar", async () => {
    const result = await api("/api/categories", { token: adminToken });
    const found = result.body.data.find(
      (row: { id_kategori: number }) => row.id_kategori === unusedId,
    );
    assert.equal(found, undefined);
  });

  await check("Hapus kategori dengan ID tidak ditemukan 404", async () => {
    const result = await api("/api/categories/999999999", {
      method: "DELETE",
      token: adminToken,
    });
    assert.equal(result.status, 404, JSON.stringify(result.body));
  });

  // Kategori yang masih dipakai barang tidak boleh terhapus.
  await check("Hapus kategori yang masih dipakai barang ditolak 409", async () => {
    const form = new FormData();
    form.append("id_kategori", String(createdId));
    form.append("nama_item", `Barang Uji Kategori ${stamp}`);
    form.append("stok", "1");
    form.append("harga_sewa_harian", "25000");
    form.append("denda_harian", "10000");

    const item = await api("/api/items", {
      method: "POST",
      token: adminToken,
      form,
    });
    assert.equal(item.status, 201, JSON.stringify(item.body));
    itemIds.push(item.body.data.id_items);

    const result = await api(`/api/categories/${createdId}`, {
      method: "DELETE",
      token: adminToken,
    });
    assert.equal(result.status, 409, JSON.stringify(result.body));
    assert.match(String(result.body.message), /masih digunakan/i);

    const { rows } = await pool.query<{ total: number }>(
      "SELECT COUNT(*)::int AS total FROM categories WHERE id_kategori = $1",
      [createdId],
    );
    assert.equal(rows[0].total, 1, "kategori harus tetap ada");
  });

  await check("Barang pada kategori tersebut tidak berubah", async () => {
    const detail = await api(`/api/items/${itemIds[0]}`, { token: adminToken });
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.data.id_kategori, createdId);
    assert.equal(detail.body.data.nama_kategori, updatedName);
    assert.equal(detail.body.data.nama_item, `Barang Uji Kategori ${stamp}`);
  });

  await check("Setelah barang dihapus, kategori dapat dihapus", async () => {
    const removeItem = await api(`/api/items/${itemIds[0]}`, {
      method: "DELETE",
      token: adminToken,
    });
    assert.equal(removeItem.status, 200, JSON.stringify(removeItem.body));

    const result = await api(`/api/categories/${createdId}`, {
      method: "DELETE",
      token: adminToken,
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
  });
}

try {
  await main();
} catch (error) {
  console.error("Verifikasi berhenti:", error);
  process.exitCode = 1;
} finally {
  if (itemIds.length > 0) {
    await pool
      .query("DELETE FROM items WHERE id_items = ANY($1::int[])", [itemIds])
      .catch(() => undefined);
  }

  if (categoryIds.length > 0) {
    await pool
      .query("DELETE FROM categories WHERE id_kategori = ANY($1::int[])", [
        categoryIds,
      ])
      .catch(() => undefined);
  }

  if (userIds.length > 0) {
    await pool
      .query("DELETE FROM users WHERE id_user = ANY($1::int[])", [userIds])
      .catch(() => undefined);
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
