import type { NextFunction, Request, Response } from "express";
import {
  countItemsInCategory,
  createCategory,
  deleteCategory,
  findAllCategories,
  findCategoryById,
  updateCategory,
} from "../services/category.service.ts";
import { parseId } from "../utils/parseId.ts";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../validations/category.validation.ts";

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

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = createCategorySchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const category = await createCategory(validation.data.nama);

      return res.status(201).json({
        success: true,
        message: "Kategori berhasil ditambahkan",
        data: category,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);

      if (id === null) {
        return res.status(400).json({
          success: false,
          message: "Id kategori tidak valid",
        });
      }

      const validation = updateCategorySchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const updated = await updateCategory(id, validation.data.nama);

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Kategori tidak ditemukan",
        });
      }

      return res.json({
        success: true,
        message: "Kategori berhasil diperbarui",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);

      if (id === null) {
        return res.status(400).json({
          success: false,
          message: "Id kategori tidak valid",
        });
      }

      const existing = await findCategoryById(id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Kategori tidak ditemukan",
        });
      }

      const totalItems = await countItemsInCategory(id);

      if (totalItems > 0) {
        return res.status(409).json({
          success: false,
          message:
            `Kategori masih digunakan oleh ${totalItems} barang sehingga ` +
            "tidak dapat dihapus",
        });
      }

      await deleteCategory(id);

      return res.json({
        success: true,
        message: "Kategori berhasil dihapus",
        data: { id_kategori: id },
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new CategoryController();
