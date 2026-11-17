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
