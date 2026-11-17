import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error.ts";

interface DatabaseError extends Error {
  code?: string;
}

function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof Error && "code" in error;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Ukuran file maksimal 5 MB"
        : err.message;

    return res.status(400).json({ success: false, message });
  }

  if (isDatabaseError(err)) {
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Data sudah ada",
      });
    }

    if (err.code === "23503") {
      return res.status(409).json({
        success: false,
        message: "Data masih digunakan oleh data lain",
      });
    }

    if (err.code === "23514") {
      return res.status(409).json({
        success: false,
        message: "Nilai tidak memenuhi aturan database",
      });
    }

    if (err.code === "22P02" || err.code === "22007") {
      return res.status(400).json({
        success: false,
        message: "Format data tidak valid",
      });
    }
  }

  if (
    err &&
    typeof err === "object" &&
    "type" in err &&
    (err as { type?: string }).type === "entity.parse.failed"
  ) {
    return res.status(400).json({
      success: false,
      message: "Format JSON tidak valid",
    });
  }

  console.error("ERROR TIDAK TERTANGANI:", err);

  return res.status(500).json({
    success: false,
    message: "Terjadi kesalahan pada server",
  });
}
