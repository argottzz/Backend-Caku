import { z } from "zod";

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

export const adminApplicationQuerySchema = z.object({
  status: z.preprocess(
    emptyToUndefined,
    z
      .enum(
        ["pending", "approved", "rejected"],
        "Status pengajuan tidak valid",
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

export const rejectAdminApplicationSchema = z.object({
  admin_rejection_reason: z.preprocess(
    emptyToUndefined,
    z
      .string("Alasan penolakan tidak valid")
      .trim()
      .max(1000, "Alasan penolakan maksimal 1000 karakter")
      .optional(),
  ),
});

export type AdminApplicationQueryInput = z.infer<
  typeof adminApplicationQuerySchema
>;
export type RejectAdminApplicationInput = z.infer<
  typeof rejectAdminApplicationSchema
>;
