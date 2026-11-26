import type { NextFunction, Request, Response } from "express";
import {
  removeProfileImage,
  updateProfileImage,
} from "../services/user.service.ts";
import type { AuthenticatedRequest } from "../types/auth.ts";
import { saveProfileImage } from "../utils/file.ts";

class UserController {
  updateProfileImage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      // Identitas selalu berasal dari token yang sudah diverifikasi.
      const { id } = (req as AuthenticatedRequest).user;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Foto profil wajib diunggah",
        });
      }

      const asset = await saveProfileImage(req.file);
      const user = await updateProfileImage(id, asset);

      return res.json({
        success: true,
        message: "Foto profil berhasil diperbarui",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  removeProfileImage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = (req as AuthenticatedRequest).user;
      const user = await removeProfileImage(id);

      return res.json({
        success: true,
        message: "Foto profil berhasil dihapus",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new UserController();
