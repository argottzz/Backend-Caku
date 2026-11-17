import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.ts";
import { AppError } from "./app-error.ts";

export const UPLOADS_ROOT = path.resolve("uploads");
export const ITEM_IMAGE_DIR = path.join(UPLOADS_ROOT, "items");
export const TRANSFER_PROOF_DIR = path.join(UPLOADS_ROOT, "bukti-transfer");

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

interface SaveImageOptions {
  directory: string;
  folder: string;
}

/**
 * Menyimpan gambar unggahan dengan nama acak dan memvalidasi isi file.
 * Mengembalikan path publik, mis. "/uploads/items/<uuid>.png".
 */
export async function saveImageFile(
  file: Express.Multer.File,
  options: SaveImageOptions,
): Promise<string> {
  if (!isAllowedImageMime(file.mimetype)) {
    throw new AppError("Tipe file gambar tidak didukung", 400);
  }

  if (!matchesMagicBytes(file.buffer, file.mimetype)) {
    throw new AppError("Isi file tidak sesuai dengan tipe gambar", 400);
  }

  const extension = EXTENSION_BY_MIME[file.mimetype];
  const filename = `${randomUUID()}${extension}`;

  await mkdir(options.directory, { recursive: true });
  await writeFile(path.join(options.directory, filename), file.buffer);

  return `/uploads/${options.folder}/${filename}`;
}

export function saveItemImage(file: Express.Multer.File): Promise<string> {
  return saveImageFile(file, {
    directory: ITEM_IMAGE_DIR,
    folder: "items",
  });
}

export function saveTransferProof(file: Express.Multer.File): Promise<string> {
  return saveImageFile(file, {
    directory: TRANSFER_PROOF_DIR,
    folder: "bukti-transfer",
  });
}

/**
 * Menghapus file unggahan berdasarkan path publiknya.
 * Hanya file di dalam folder uploads yang boleh dihapus.
 */
export async function deleteUploadedFile(
  publicPath: string | null | undefined,
): Promise<void> {
  if (!publicPath?.startsWith("/uploads/")) {
    return;
  }

  const relativePath = publicPath.slice("/uploads/".length);
  const absolutePath = path.resolve(UPLOADS_ROOT, relativePath);
  const relativeToRoot = path.relative(UPLOADS_ROOT, absolutePath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return;
  }

  try {
    await unlink(absolutePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== "ENOENT") {
      console.warn(`Gagal menghapus file ${publicPath}:`, error);
    }
  }
}

export function buildFileUrl(publicPath: string | null): string | null {
  if (!publicPath) {
    return null;
  }

  return `${env.appUrl}${publicPath}`;
}
