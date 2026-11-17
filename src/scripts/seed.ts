import bcrypt from "bcryptjs";
import pool from "../db/index.ts";
import { env } from "../config/env.ts";

const categories = [
  "Tenda dan Shelter",
  "Perlengkapan Tidur",
  "Peralatan Masak dan Makan",
  "Penerangan dan Listrik",
  "Tas dan Perlengkapan Pendukung",
];

async function seedCategories(): Promise<void> {
  for (const nama of categories) {
    await pool.query(
      "INSERT INTO categories (nama) VALUES ($1) ON CONFLICT (nama) DO NOTHING",
      [nama],
    );
  }

  console.log(`Kategori siap: ${categories.length} data`);
}

interface SeedUserInput {
  nama: string;
  email: string;
  password: string;
  role: "admin" | "customer";
}

async function seedUser(input: SeedUserInput): Promise<void> {
  if (!input.password) {
    throw new Error(`Password seed untuk role ${input.role} belum diisi`);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const email = input.email.toLowerCase().trim();

  await pool.query(
    `INSERT INTO users (nama, email, password_hash, role)
     VALUES ($1, $2, $3, $4::role_type)
     ON CONFLICT (email) DO NOTHING`,
    [input.nama, email, passwordHash, input.role],
  );

  console.log(`Akun ${input.role} siap: ${email}`);
}

try {
  await seedCategories();
  await seedUser({ ...env.seed.admin, role: "admin" });
  await seedUser({ ...env.seed.customer, role: "customer" });
  console.log("Seed selesai");
} catch (error) {
  console.error("Seed gagal:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
