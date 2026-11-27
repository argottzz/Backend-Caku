import pool from "../db/index.ts";
import { AppError } from "../utils/app-error.ts";

export interface CategoryRecord {
  id_kategori: number;
  nama: string;
}

// Kode error PostgreSQL: 23505 = unique_violation, 23503 = foreign_key_violation,
// 23001 = restrict_violation.
function hasDatabaseCode(error: unknown, ...codes: string[]): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = (error as { code?: string }).code;
  return code !== undefined && codes.includes(code);
}

export async function findAllCategories(): Promise<CategoryRecord[]> {
  const { rows } = await pool.query<CategoryRecord>(
    `SELECT id_kategori, nama
     FROM categories
     ORDER BY id_kategori ASC`,
  );

  return rows;
}

export async function findCategoryById(
  id: number,
): Promise<CategoryRecord | null> {
  const { rows } = await pool.query<CategoryRecord>(
    `SELECT id_kategori, nama
     FROM categories
     WHERE id_kategori = $1
     LIMIT 1`,
    [id],
  );

  return rows[0] ?? null;
}

export async function categoryExists(id: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    "SELECT 1 FROM categories WHERE id_kategori = $1",
    [id],
  );

  return (rowCount ?? 0) > 0;
}

/**
 * Jumlah barang yang masih memakai kategori ini. Dipakai sebelum menghapus
 * agar Admin mendapat pesan yang jelas, bukan hanya penolakan dari database.
 */
export async function countItemsInCategory(id: number): Promise<number> {
  const { rows } = await pool.query<{ total: number }>(
    "SELECT COUNT(*)::int AS total FROM items WHERE id_kategori = $1",
    [id],
  );

  return rows[0]?.total ?? 0;
}

export async function createCategory(nama: string): Promise<CategoryRecord> {
  try {
    const { rows } = await pool.query<CategoryRecord>(
      `INSERT INTO categories (nama)
       VALUES ($1)
       RETURNING id_kategori, nama`,
      [nama],
    );

    return rows[0];
  } catch (error) {
    if (hasDatabaseCode(error, "23505")) {
      throw new AppError("Nama kategori sudah digunakan", 409);
    }

    throw error;
  }
}

export async function updateCategory(
  id: number,
  nama: string,
): Promise<CategoryRecord | null> {
  try {
    const { rows } = await pool.query<CategoryRecord>(
      `UPDATE categories
       SET nama = $1
       WHERE id_kategori = $2
       RETURNING id_kategori, nama`,
      [nama, id],
    );

    return rows[0] ?? null;
  } catch (error) {
    if (hasDatabaseCode(error, "23505")) {
      throw new AppError("Nama kategori sudah digunakan", 409);
    }

    throw error;
  }
}

/**
 * ON DELETE RESTRICT pada `items.fk_items_categories` membuat penghapusan
 * kategori yang masih dipakai gagal di level database. Error itu diterjemahkan
 * menjadi 409 agar response tetap konsisten walau ada permintaan bersamaan.
 */
export async function deleteCategory(id: number): Promise<boolean> {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM categories WHERE id_kategori = $1",
      [id],
    );

    return (rowCount ?? 0) > 0;
  } catch (error) {
    if (hasDatabaseCode(error, "23503", "23001")) {
      throw new AppError(
        "Kategori masih digunakan oleh barang sehingga tidak dapat dihapus",
        409,
      );
    }

    throw error;
  }
}
