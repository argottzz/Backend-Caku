import pg from "pg";
import { env } from "../config/env.ts";

const { Pool, types } = pg;

// DATE (OID 1082) dipertahankan sebagai string "YYYY-MM-DD" agar tidak
// bergeser akibat konversi zona waktu. NUMERIC sengaja tidak diubah agar
// tetap berupa string dan perhitungan uang dilakukan dalam satuan sen.
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
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export default pool;
