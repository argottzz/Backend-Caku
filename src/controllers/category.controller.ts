import type { NextFunction, Request, Response } from "express";
import { findAllCategories } from "../services/category.service.ts";

class CategoryController {
  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await findAllCategories();

      return res.json({
        success: true,
        message: "Daftar kategori berhasil diambil",
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new CategoryController();
