import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "../config/env.ts";

const { Pool, types } = pg;

// DATE (OID 1082) dipertahankan sebagai string "YYYY-MM-DD"
// agar tidak bergeser akibat konversi zona waktu.
// NUMERIC tetap berupa string agar perhitungan uang dilakukan dalam satuan sen.
types.setTypeParser(1082, (value) => value);

if (!env.db.password) {
  console.warn(
    "DB_PASS belum diisi. Isi DB_PASS di .env jika PostgreSQL memakai autentikasi password.",
  );
}

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,

  // SSL untuk koneksi PostgreSQL Aiven
  ssl: {
    ca: readFileSync(
      resolve(process.cwd(), "certs", "ca.pem"),
      "utf8",
    ),
    rejectUnauthorized: true,
  },

  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

/**
 * Menjalankan beberapa query dalam satu transaksi.
 * COMMIT jika berhasil, ROLLBACK jika terjadi error.
 */
export async function withTransaction<T>(
  handler: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
