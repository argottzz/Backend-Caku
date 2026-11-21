import app from "./app.ts";
import pool from "./db/index.ts";
import { env } from "./config/env.ts";

try {
  await pool.query("SELECT 1");
  console.log("Koneksi database berhasil");
} catch (error) {
  console.error("Koneksi database gagal:", error);
  process.exit(1);
}

app.listen(env.port, "0.0.0.0", () => {
  console.log(`Server berjalan pada port ${env.port}`);
});