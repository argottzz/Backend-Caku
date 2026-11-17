import { z } from "zod";
import { isValidDateString } from "../utils/date.ts";

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

const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string("Tanggal tidak valid")
    .trim()
    .refine(isValidDateString, "Format tanggal harus YYYY-MM-DD dan valid")
    .optional(),
);

export const reportQuerySchema = z
  .object({
    start_date: optionalDate,
    end_date: optionalDate,
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
  })
  .superRefine((data, context) => {
    if (data.start_date && data.end_date && data.start_date > data.end_date) {
      context.addIssue({
        code: "custom",
        message: "Tanggal akhir tidak boleh sebelum tanggal mulai",
        path: ["end_date"],
      });
    }
  });

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
