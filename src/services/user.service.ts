import pool from "../db/index.ts";
import type { AuthUser } from "../types/auth.ts";
import { AppError } from "../utils/app-error.ts";
import {
  deleteCloudinaryByPublicId,
  deleteCloudinaryFile,
  type UploadedImageAsset,
} from "../utils/file.ts";
import { findUserById } from "./auth.service.ts";

interface ProfileImageRow {
  profile_image: string | null;
  profile_image_public_id: string | null;
}

async function findProfileImageRow(
  userId: number,
): Promise<ProfileImageRow | null> {
  const { rows } = await pool.query<ProfileImageRow>(
    `SELECT profile_image, profile_image_public_id
     FROM users
     WHERE id_user = $1
     LIMIT 1`,
    [userId],
  );

  return rows[0] ?? null;
}

async function deleteStoredProfileImage(row: ProfileImageRow): Promise<void> {
  if (row.profile_image_public_id) {
    await deleteCloudinaryByPublicId(row.profile_image_public_id);
    return;
  }

  // Data lama mungkin hanya menyimpan URL tanpa public_id.
  if (row.profile_image) {
    await deleteCloudinaryFile(row.profile_image);
  }
}

/**
 * Menyimpan foto profil baru lalu menghapus foto lama.
 *
 * Urutan sengaja dipilih agar foto lama tidak pernah hilang lebih dulu:
 * 1. Aset baru sudah diunggah oleh controller.
 * 2. Simpan URL + public_id baru ke database.
 * 3. Setelah database berhasil, hapus aset lama dari Cloudinary.
 *
 * Jika penyimpanan database gagal, aset baru dibersihkan dan foto lama
 * tetap utuh. Jika penghapusan aset lama gagal, database sudah konsisten;
 * aset lama hanya menjadi orphan di Cloudinary (dicatat sebagai warning).
 */
export async function updateProfileImage(
  userId: number,
  asset: UploadedImageAsset,
): Promise<AuthUser> {
  const current = await findProfileImageRow(userId);

  if (!current) {
    await deleteCloudinaryByPublicId(asset.publicId);
    throw new AppError("User tidak ditemukan", 404);
  }

  try {
    await pool.query(
      `UPDATE users
       SET profile_image = $1, profile_image_public_id = $2
       WHERE id_user = $3`,
      [asset.url, asset.publicId, userId],
    );
  } catch (error) {
    // Jangan tinggalkan aset baru yang tidak dirujuk database.
    await deleteCloudinaryByPublicId(asset.publicId);
    throw error;
  }

  await deleteStoredProfileImage(current);

  const user = await findUserById(userId);

  if (!user) {
    throw new Error("Gagal mengambil profil terbaru");
  }

  return user;
}

/**
 * Menghapus foto profil milik sendiri.
 *
 * Database dikosongkan lebih dulu agar akun tidak lagi merujuk ke aset.
 * Jika penghapusan Cloudinary gagal, akun tetap tanpa foto (status yang
 * diinginkan) dan aset lama hanya menjadi orphan yang dicatat sebagai
 * warning. Jika database gagal, foto lama tetap utuh.
 */
export async function removeProfileImage(userId: number): Promise<AuthUser> {
  const current = await findProfileImageRow(userId);

  if (!current) {
    throw new AppError("User tidak ditemukan", 404);
  }

  await pool.query(
    `UPDATE users
     SET profile_image = NULL, profile_image_public_id = NULL
     WHERE id_user = $1`,
    [userId],
  );

  await deleteStoredProfileImage(current);

  const user = await findUserById(userId);

  if (!user) {
    throw new Error("Gagal mengambil profil terbaru");
  }

  return user;
}
