import type { NextFunction, Request, Response } from "express";
import { findUserById } from "../services/auth.service.ts";
import type { AuthenticatedRequest } from "../types/auth.ts";
import { decodeToken, extractToken } from "../utils/auth.ts";

/**
 * Memverifikasi JWT lalu memuat ulang data pengguna dari database.
 *
 * Role diambil dari database, bukan dari klaim token, sehingga perubahan role
 * (mis. setelah pengajuan admin disetujui) langsung berlaku pada token yang
 * masih aktif. Token lama dengan klaim role customer tidak dapat dipakai untuk
 * mengakses endpoint admin bila role di database bukan admin.
 */
export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token tidak ditemukan",
    });
  }

  const payload = decodeToken(token);

  if (!payload) {
    return res.status(401).json({
      success: false,
      message: "Token tidak valid atau kadaluarsa",
    });
  }

  try {
    const user = await findUserById(payload.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Sesi tidak valid, silakan login kembali",
      });
    }

    (req as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    next(error);
  }
}
