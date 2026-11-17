import { z } from "zod";
import { isValidDateString, todayDateString } from "../utils/date.ts";

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

const dateField = z
  .string("Tanggal wajib diisi")
  .trim()
  .refine(isValidDateString, "Format tanggal harus YYYY-MM-DD dan valid");

const rentalItemSchema = z.object({
  id_items: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number("Id item tidak valid")
      .int("Id item tidak valid")
      .positive("Id item tidak valid"),
  ),
  jumlah: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number("Jumlah wajib diisi")
      .int("Jumlah harus bilangan bulat")
      .positive("Jumlah minimal 1")
      .max(2_147_483_647, "Jumlah terlalu besar"),
  ),
});

const itemsField = z
  .array(rentalItemSchema, "Daftar item tidak valid")
  .min(1, "Minimal satu item wajib dipilih")
  .max(50, "Maksimal 50 jenis item per transaksi")
  .superRefine((items, context) => {
    const seen = new Set<number>();

    items.forEach((item, index) => {
      if (seen.has(item.id_items)) {
        context.addIssue({
          code: "custom",
          message: "Item tidak boleh dipilih lebih dari sekali",
          path: [index, "id_items"],
        });
      }

      seen.add(item.id_items);
    });
  });

export const createRentalSchema = z
  .object({
    tanggal_mulai: dateField,
    tanggal_selesai: dateField,
    items: itemsField,
  })
  .superRefine((data, context) => {
    if (data.tanggal_selesai < data.tanggal_mulai) {
      context.addIssue({
        code: "custom",
        message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
        path: ["tanggal_selesai"],
      });
    }

    if (data.tanggal_mulai < todayDateString()) {
      context.addIssue({
        code: "custom",
        message: "Tanggal mulai tidak boleh sebelum hari ini",
        path: ["tanggal_mulai"],
      });
    }
  });

export const rentalQuerySchema = z.object({
  status: z.preprocess(
    emptyToUndefined,
    z
      .enum(
        ["pending", "approved", "ongoing", "completed", "rejected"],
        "Status tidak valid",
      )
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

export const updateRentalStatusSchema = z.object({
  status: z.enum(
    ["approved", "ongoing", "rejected"],
    "Status hanya boleh approved, ongoing, atau rejected",
  ),
});

export type CreateRentalInput = z.infer<typeof createRentalSchema>;
export type RentalQueryInput = z.infer<typeof rentalQuerySchema>;
export type UpdateRentalStatusInput = z.infer<
  typeof updateRentalStatusSchema
>;
