import { z } from "zod";

const emailSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.email("Format email tidak valid").max(100, "Email maksimal 100 karakter"),
);

export const registerSchema = z.object({
  nama: z
    .string("Nama wajib diisi")
    .trim()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  email: emailSchema,
  password: z
    .string("Password wajib diisi")
    .min(6, "Password minimal 6 karakter")
    .max(72, "Password maksimal 72 karakter"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string("Password wajib diisi").min(1, "Password wajib diisi"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
