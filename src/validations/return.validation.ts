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

export const returnRentalSchema = z.object({
  tanggal_kembali_aktual: z
    .string("Tanggal kembali wajib diisi")
    .trim()
    .refine(isValidDateString, "Format tanggal harus YYYY-MM-DD dan valid")
    .refine(
      (value) => value <= todayDateString(),
      "Tanggal kembali tidak boleh melebihi hari ini",
    ),
  kondisi_pengembalian: z.enum(
    ["Baik", "Rusak", "Hilang"],
    "Kondisi harus Baik, Rusak, atau Hilang",
  ),
  catatan_pengembalian: z.preprocess(
    emptyToUndefined,
    z
      .string("Catatan tidak valid")
      .trim()
      .max(5000, "Catatan maksimal 5000 karakter")
      .optional(),
  ),
});

export type ReturnRentalInput = z.infer<typeof returnRentalSchema>;
