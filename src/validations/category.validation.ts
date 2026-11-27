import { z } from "zod";

/**
 * Nama kategori mengikuti kolom `categories.nama VARCHAR(100) UNIQUE NOT NULL`.
 * `trim()` berjalan sebelum `min`, sehingga input yang hanya berisi spasi
 * ditolak sebagai nama kosong.
 */
const categoryNameField = z
  .string("Nama kategori wajib diisi")
  .trim()
  .min(1, "Nama kategori wajib diisi")
  .max(100, "Nama kategori maksimal 100 karakter");

export const createCategorySchema = z.object({
  nama: categoryNameField,
});

export const updateCategorySchema = z.object({
  nama: categoryNameField,
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
