import { z } from "zod";

const emailSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.email("Format email tidak valid").max(100, "Email maksimal 100 karakter"),
);

const phoneSchema = z
  .string("Nomor telepon wajib diisi")
  .trim()
  .regex(
    /^\+?[0-9]{8,15}$/,
    "Format nomor telepon tidak valid",
  );

export const registerSchema = z.object({
  nama: z
    .string("Nama wajib diisi")
    .trim()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  email: emailSchema,
  phone_number: phoneSchema,
  password: z
    .string("Password wajib diisi")
    .min(6, "Password minimal 6 karakter")
    .max(72, "Password maksimal 72 karakter"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string("Password wajib diisi").min(1, "Password wajib diisi"),
});

export const changePasswordSchema = z.object({
  current_password: z
    .string("Password lama wajib diisi")
    .min(1, "Password lama wajib diisi"),
  new_password: z
    .string("Password baru wajib diisi")
    .min(6, "Password baru minimal 6 karakter")
    .max(72, "Password baru maksimal 72 karakter"),
  confirm_password: z
    .string("Konfirmasi password wajib diisi")
    .min(1, "Konfirmasi password wajib diisi"),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Konfirmasi password tidak cocok",
  path: ["confirm_password"],
});

export const updateProfileSchema = z.object({
  phone_number: phoneSchema.optional(),
  nama: z
    .string()
    .trim()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter")
    .optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
