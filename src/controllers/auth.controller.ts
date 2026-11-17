import type { NextFunction, Request, Response } from "express";
import {
  findUserById,
  loginUser,
  registerUser,
} from "../services/auth.service.ts";
import type { AuthenticatedRequest } from "../types/auth.ts";
import {
  loginSchema,
  registerSchema,
} from "../validations/auth.validation.ts";

class AuthController {
  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = registerSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const result = await registerUser(validation.data);

      return res.status(201).json({
        success: true,
        message: "Register berhasil",
        data: result.user,
        token: result.token,
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = loginSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const result = await loginUser(validation.data);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: "Email atau password salah",
        });
      }

      return res.json({
        success: true,
        message: "Login berhasil",
        data: result.user,
        token: result.token,
      });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as AuthenticatedRequest).user;
      const user = await findUserById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User tidak ditemukan",
        });
      }

      return res.json({
        success: true,
        message: "Profil berhasil diambil",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new AuthController();
