import { randomUUID } from "node:crypto";
import cloudinary, { isCloudinaryConfigured } from "../config/cloudinary.ts";
import { env } from "../config/env.ts";
import { AppError } from "./app-error.ts";

const EXTENSION_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;

export type AllowedImageMime = keyof typeof EXTENSION_BY_MIME;

export const ALLOWED_IMAGE_MIME_TYPES = Object.keys(
  EXTENSION_BY_MIME,
) as AllowedImageMime[];

export const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export const ITEM_IMAGE_FOLDER = "caku/items";
export const TRANSFER_PROOF_FOLDER = "caku/bukti-transfer";
export const PROFILE_IMAGE_FOLDER = "caku/profile-images";

export interface UploadedImageAsset {
  url: string;
  publicId: string;
}

export function isAllowedImageMime(mime: string): mime is AllowedImageMime {
  return mime in EXTENSION_BY_MIME;
}

function matchesMagicBytes(buffer: Buffer, mime: AllowedImageMime): boolean {
  if (buffer.length < 12) {
    return false;
  }

  if (mime === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mime === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  return (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

/**
 * Mengunggah gambar ke Cloudinary dengan public_id berupa UUID.
 * Nama file asli tidak pernah dipakai. Mengembalikan URL dan public_id.
 */
export async function uploadImageAsset(
  file: Express.Multer.File,
  folder: string,
): Promise<UploadedImageAsset> {
  if (!isCloudinaryConfigured) {
    throw new AppError("Konfigurasi Cloudinary belum lengkap", 500);
  }

  if (!isAllowedImageMime(file.mimetype)) {
    throw new AppError("Tipe file gambar tidak didukung", 400);
  }

  if (!matchesMagicBytes(file.buffer, file.mimetype)) {
    throw new AppError("Isi file tidak sesuai dengan tipe gambar", 400);
  }

  const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    public_id: randomUUID(),
    resource_type: "image",
    overwrite: false,
  });

  return { url: result.secure_url, publicId: result.public_id };
}

/**
 * Mengunggah gambar dan hanya mengembalikan secure_url.
 * Dipertahankan agar pemanggil lama tidak berubah.
 */
export async function uploadImageToCloudinary(
  file: Express.Multer.File,
  folder: string,
): Promise<string> {
  const asset = await uploadImageAsset(file, folder);
  return asset.url;
}

export function saveItemImage(file: Express.Multer.File): Promise<string> {
  return uploadImageToCloudinary(file, ITEM_IMAGE_FOLDER);
}

export function saveTransferProof(file: Express.Multer.File): Promise<string> {
  return uploadImageToCloudinary(file, TRANSFER_PROOF_FOLDER);
}

export function saveProfileImage(
  file: Express.Multer.File,
): Promise<UploadedImageAsset> {
  return uploadImageAsset(file, PROFILE_IMAGE_FOLDER);
}

function extractPublicId(value: string): string | null {
  const cleanValue = value.split("?")[0]?.split("#")[0] ?? "";
  const match = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(.+)$/.exec(
    cleanValue,
  );

  if (!match) {
    return null;
  }

  return decodeURIComponent(
    match[1].replace(/^v\d+\//, "").replace(/\.[A-Za-z0-9]+$/, ""),
  );
}

/**
 * Menghapus gambar Cloudinary berdasarkan URL atau public_id yang tersimpan.
 * Nilai selain aset Cloudinary (mis. path lama "/uploads/...") diabaikan.
 */
export async function deleteCloudinaryFile(
  storedValue: string | null | undefined,
): Promise<void> {
  if (!storedValue || !isCloudinaryConfigured) {
    return;
  }

  const publicId = extractPublicId(storedValue);

  if (!publicId) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });
  } catch (error) {
    console.warn(`Gagal menghapus aset Cloudinary ${publicId}:`, error);
  }
}

/**
 * Menghapus aset Cloudinary berdasarkan public_id yang tersimpan.
 * Dipakai untuk foto profil yang menyimpan public_id secara eksplisit.
 * Kegagalan Cloudinary hanya dicatat agar alur database tidak gagal.
 */
export async function deleteCloudinaryByPublicId(
  publicId: string | null | undefined,
): Promise<void> {
  if (!publicId || !isCloudinaryConfigured) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });
  } catch (error) {
    console.warn(`Gagal menghapus aset Cloudinary ${publicId}:`, error);
  }
}

/**
 * Mengembalikan URL siap pakai. Nilai absolut (Cloudinary) dikembalikan apa
 * adanya, sedangkan path relatif lama tetap diprefiks APP_URL.
 */
export function buildFileUrl(storedValue: string | null): string | null {
  if (!storedValue) {
    return null;
  }

  if (/^https?:\/\//i.test(storedValue)) {
    return storedValue;
  }

  return `${env.appUrl}${storedValue}`;
}
