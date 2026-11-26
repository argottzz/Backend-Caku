import { z } from "zod";

/**
 * Penyelesaian penggantian hanya boleh mengubah status menjadi
 * Completed. Nominal tidak pernah diterima dari client.
 */
export const updateReplacementSchema = z.object({
  status: z.enum(["Completed"], "Status hanya boleh Completed"),
});

export type UpdateReplacementInput = z.infer<
  typeof updateReplacementSchema
>;
