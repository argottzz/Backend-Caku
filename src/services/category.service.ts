import pool from "../db/index.ts";

export interface CategoryRecord {
  id_kategori: number;
  nama: string;
}

export async function findAllCategories(): Promise<CategoryRecord[]> {
  const { rows } = await pool.query<CategoryRecord>(
    `SELECT id_kategori, nama
     FROM categories
     ORDER BY id_kategori ASC`,
  );

  return rows;
}

export async function categoryExists(id: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    "SELECT 1 FROM categories WHERE id_kategori = $1",
    [id],
  );

  return (rowCount ?? 0) > 0;
}
