import type { NextFunction, Request, Response } from "express";
import {
  completeReplacement,
  createRental,
  deleteRental,
  findRentals,
  getRentalForUser,
  returnRental,
  updateRentalStatus,
} from "../services/rental.service.ts";
import type { AuthenticatedRequest } from "../types/auth.ts";
import { deleteCloudinaryFile, saveTransferProof } from "../utils/file.ts";
import { parseId } from "../utils/parseId.ts";
import { updateReplacementSchema } from "../validations/replacement.validation.ts";
import {
  createRentalSchema,
  rentalQuerySchema,
  updateRentalStatusSchema,
} from "../validations/rental.validation.ts";
import { returnRentalSchema } from "../validations/return.validation.ts";

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
        await deleteCloudinaryFile(savedProof);
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
        await deleteCloudinaryFile(buktiTransfer);
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

  returnRental = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);

      if (id === null) {
        return res.status(400).json({
          success: false,
          message: "Id rental tidak valid",
        });
      }

      const validation = returnRentalSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const rental = await returnRental(
        id,
        validation.data,
        (req as AuthenticatedRequest).user.id,
      );

      const message =
        rental.kondisi_pengembalian === "Baik"
          ? "Pengembalian berhasil diproses"
          : rental.penggantian_perlu_ditinjau
            ? "Pengembalian berhasil diproses, tetapi sebagian barang belum memiliki harga asli sehingga penggantian perlu ditinjau admin"
            : rental.kondisi_pengembalian === "Hilang"
              ? "Pengembalian berhasil diproses dan kewajiban penggantian barang hilang telah dicatat"
              : "Pengembalian berhasil diproses, sesuaikan stok untuk barang rusak";

      return res.json({
        success: true,
        message,
        data: rental,
      });
    } catch (error) {
      next(error);
    }
  };

  completeReplacement = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const id = parseId(req.params.id);

      if (id === null) {
        return res.status(400).json({
          success: false,
          message: "Id rental tidak valid",
        });
      }

      const validation = updateReplacementSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const replacement = await completeReplacement(
        id,
        (req as AuthenticatedRequest).user.id,
      );

      return res.json({
        success: true,
        message:
          replacement.status === "Completed"
            ? "Penggantian barang hilang berhasil diselesaikan"
            : "Status penggantian berhasil diperbarui",
        data: replacement,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new RentalController();
