import type { NextFunction, Request, Response } from "express";
import {
  applyForAdmin,
  findApplicationById,
  findApplications,
  getMyApplication,
  reviewApplication,
} from "../services/admin-application.service.ts";
import type { AuthenticatedRequest } from "../types/auth.ts";
import { parseId } from "../utils/parseId.ts";
import {
  adminApplicationQuerySchema,
  rejectAdminApplicationSchema,
} from "../validations/admin-application.validation.ts";

class AdminApplicationController {
  apply = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as AuthenticatedRequest).user;
      const application = await applyForAdmin(id);

      return res.status(201).json({
        success: true,
        message: "Pengajuan menjadi admin berhasil dibuat",
        data: application,
      });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as AuthenticatedRequest).user;
      const application = await getMyApplication(id);

      if (!application) {
        return res.status(404).json({
          success: false,
          message: "User tidak ditemukan",
        });
      }

      return res.json({
        success: true,
        message: application.admin_application_status
          ? "Status pengajuan berhasil diambil"
          : "Anda belum pernah mengajukan menjadi admin",
        data: application,
      });
    } catch (error) {
      next(error);
    }
  };

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = adminApplicationQuerySchema.safeParse(req.query);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Parameter tidak valid",
          error: validation.error.issues,
        });
      }

      const result = await findApplications(validation.data);

      return res.json({
        success: true,
        message: "Daftar pengajuan admin berhasil diambil",
        data: result.applications,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);

      if (id === null) {
        return res.status(400).json({
          success: false,
          message: "Id pengajuan tidak valid",
        });
      }

      const application = await findApplicationById(id);

      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Pengajuan tidak ditemukan",
        });
      }

      return res.json({
        success: true,
        message: "Detail pengajuan admin berhasil diambil",
        data: application,
      });
    } catch (error) {
      next(error);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);

      if (id === null) {
        return res.status(400).json({
          success: false,
          message: "Id pengajuan tidak valid",
        });
      }

      const application = await reviewApplication(
        id,
        (req as AuthenticatedRequest).user,
        "approve",
      );

      return res.json({
        success: true,
        message: "Pengajuan menjadi admin berhasil disetujui",
        data: application,
      });
    } catch (error) {
      next(error);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);

      if (id === null) {
        return res.status(400).json({
          success: false,
          message: "Id pengajuan tidak valid",
        });
      }

      const validation = rejectAdminApplicationSchema.safeParse(
        req.body ?? {},
      );

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const application = await reviewApplication(
        id,
        (req as AuthenticatedRequest).user,
        "reject",
        validation.data.admin_rejection_reason,
      );

      return res.json({
        success: true,
        message: "Pengajuan menjadi admin berhasil ditolak",
        data: application,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new AdminApplicationController();
