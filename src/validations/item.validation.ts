import { z } from "zod";
import { formatCents, toCents } from "../utils/money.ts";

const MAX_MONEY_CENTS = 999_999_999_999;

function emptyToUndefined(value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  return value;
}

const integerField = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number("Nilai wajib berupa angka")
    .int("Nilai harus bilangan bulat"),
);

const moneyField = z
  .union([z.string(), z.number()], "Nilai uang wajib diisi")
  .transform((value, context) => {
    const text = String(value).trim();

    if (!/^-?\d+(\.\d{1,2})?$/.test(text)) {
      context.addIssue({
        code: "custom",
        message: "Format uang tidak valid (maksimal 2 angka desimal)",
      });
      return z.NEVER;
    }

    const cents = toCents(text);

    if (cents < 0) {
      context.addIssue({
        code: "custom",
        message: "Nilai uang tidak boleh negatif",
      });
      return z.NEVER;
    }

    if (cents > MAX_MONEY_CENTS) {
      context.addIssue({
        code: "custom",
        message: "Nilai uang terlalu besar",
      });
      return z.NEVER;
    }

    return formatCents(cents);
  });

const descriptionField = z.preprocess(
  emptyToUndefined,
  z
    .string("Deskripsi tidak valid")
    .trim()
    .max(5000, "Deskripsi maksimal 5000 karakter")
    .optional(),
);

export const createItemSchema = z.object({
  id_kategori: integerField.pipe(
    z.number().positive("Kategori wajib dipilih"),
  ),
  nama_item: z
    .string("Nama item wajib diisi")
    .trim()
    .min(1, "Nama item wajib diisi")
    .max(100, "Nama item maksimal 100 karakter"),
  deskripsi: descriptionField,
  stok: integerField.pipe(
    z
      .number()
      .min(0, "Stok tidak boleh negatif")
      .max(2_147_483_647, "Stok terlalu besar"),
  ),
  harga_sewa_harian: moneyField,
  denda_harian: moneyField,
});

export const updateItemSchema = createItemSchema;

export const itemQuerySchema = z.object({
  search: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(100, "Kata kunci maksimal 100 karakter").optional(),
  ),
  id_kategori: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number("Kategori tidak valid")
      .int("Kategori tidak valid")
      .positive("Kategori tidak valid")
      .optional(),
  ),
  page: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number("Halaman tidak valid")
      .int("Halaman tidak valid")
      .min(1, "Halaman minimal 1")
      .default(1),
  ),
  limit: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number("Limit tidak valid")
      .int("Limit tidak valid")
      .min(1, "Limit minimal 1")
      .max(100, "Limit maksimal 100")
      .default(10),
  ),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ItemQueryInput = z.infer<typeof itemQuerySchema>;
