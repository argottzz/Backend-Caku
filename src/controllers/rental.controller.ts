import type { NextFunction, Request, Response } from "express";
import {
  createRental,
  deleteRental,
  findRentals,
  getRentalForUser,
  updateRentalStatus,
} from "../services/rental.service.ts";
import type { AuthenticatedRequest } from "../types/auth.ts";
import { deleteUploadedFile, saveTransferProof } from "../utils/file.ts";
import { parseId } from "../utils/parseId.ts";
import {
  createRentalSchema,
  rentalQuerySchema,
  updateRentalStatusSchema,
} from "../validations/rental.validation.ts";

class RentalController {
  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = rentalQuerySchema.safeParse(req.query);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Parameter tidak valid",
          error: validation.error.issues,
        });
      }

      const result = await findRentals(
        (req as AuthenticatedRequest).user,
        validation.data,
      );

      return res.json({
        success: true,
        message: "Daftar rental berhasil diambil",
        data: result.rentals,
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
          message: "Id rental tidak valid",
        });
      }

      const rental = await getRentalForUser(
        id,
        (req as AuthenticatedRequest).user,
      );

      return res.json({
        success: true,
        message: "Detail rental berhasil diambil",
        data: rental,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    let savedProof: string | null = null;

    try {
      const rawItems = req.body?.items;
      let items: unknown = rawItems;

      if (typeof rawItems === "string") {
        try {
          items = JSON.parse(rawItems);
        } catch {
          return res.status(400).json({
            success: false,
            message: "Format items tidak valid, harus berupa JSON",
          });
        }
      }

      const validation = createRentalSchema.safeParse({
        tanggal_mulai: req.body?.tanggal_mulai,
        tanggal_selesai: req.body?.tanggal_selesai,
        items,
      });

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Bukti transfer wajib diunggah",
        });
      }

      savedProof = await saveTransferProof(req.file);

      const rental = await createRental(
        (req as AuthenticatedRequest).user.id,
        validation.data,
        savedProof,
      );

      return res.status(201).json({
        success: true,
        message: "Pengajuan penyewaan berhasil dibuat",
        data: rental,
      });
    } catch (error) {
      if (savedProof) {
        await deleteUploadedFile(savedProof);
      }

      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);

      if (id === null) {
        return res.status(400).json({
          success: false,
          message: "Id rental tidak valid",
        });
      }

      const buktiTransfer = await deleteRental(
        id,
        (req as AuthenticatedRequest).user.id,
      );

      if (buktiTransfer) {
        await deleteUploadedFile(buktiTransfer);
      }

      return res.json({
        success: true,
        message: "Pengajuan penyewaan berhasil dibatalkan",
        data: { id_rental: id },
      });
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);

      if (id === null) {
        return res.status(400).json({
          success: false,
          message: "Id rental tidak valid",
        });
      }

      const validation = updateRentalStatusSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const rental = await updateRentalStatus(id, validation.data.status);

      return res.json({
        success: true,
        message: `Status rental berhasil diubah menjadi ${rental.status}`,
        data: rental,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new RentalController();
