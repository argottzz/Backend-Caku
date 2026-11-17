import type { NextFunction, Request, Response } from "express";
import { getReportSummary } from "../services/report.service.ts";
import { reportQuerySchema } from "../validations/report.validation.ts";

class ReportController {
  summary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = reportQuerySchema.safeParse(req.query);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Parameter tidak valid",
          error: validation.error.issues,
        });
      }

      const result = await getReportSummary(validation.data);

      return res.json({
        success: true,
        message: "Ringkasan laporan berhasil diambil",
        data: {
          ringkasan: result.ringkasan,
          rentals: result.rentals,
        },
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new ReportController();
