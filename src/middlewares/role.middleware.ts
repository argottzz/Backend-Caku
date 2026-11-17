import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest, UserRole } from "../types/auth.ts";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;

    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Role tidak diizinkan.",
      });
    }

    next();
  };
}
