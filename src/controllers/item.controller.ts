import type { NextFunction, Request, Response } from "express";
import { categoryExists } from "../services/category.service.ts";
import {
  createItem,
  deleteItem,
  findItemById,
  findItems,
  updateItem,
} from "../services/item.service.ts";
import { deleteUploadedFile, saveItemImage } from "../utils/file.ts";
import { parseId } from "../utils/parseId.ts";
import {
  createItemSchema,
  itemQuerySchema,
  updateItemSchema,
} from "../validations/item.validation.ts";

class ItemController {
  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = itemQuerySchema.safeParse(req.query);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Parameter tidak valid",
          error: validation.error.issues,
        });
      }

      const result = await findItems(validation.data);

      return res.json({
        success: true,
        message: "Daftar item berhasil diambil",
        data: result.items,
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
          message: "Id item tidak valid",
        });
      }

      const item = await findItemById(id);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: "Item tidak ditemukan",
        });
      }

      return res.json({
        success: true,
        message: "Detail item berhasil diambil",
        data: item,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    let savedImage: string | null = null;

    try {
      const validation = createItemSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const categoryIsValid = await categoryExists(
        validation.data.id_kategori,
      );

      if (!categoryIsValid) {
        return res.status(404).json({
          success: false,
          message: "Kategori tidak ditemukan",
        });
      }

      if (req.file) {
        savedImage = await saveItemImage(req.file);
      }

      const item = await createItem(validation.data, savedImage);

      return res.status(201).json({
        success: true,
        message: "Item berhasil ditambahkan",
        data: item,
      });
    } catch (error) {
      if (savedImage) {
        await deleteUploadedFile(savedImage);
      }

      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    let savedImage: string | null = null;

    try {
      const id = parseId(req.params.id);

      if (id === null) {
        return res.status(400).json({
          success: false,
          message: "Id item tidak valid",
        });
      }

      const validation = updateItemSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const existing = await findItemById(id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Item tidak ditemukan",
        });
      }

      const categoryIsValid = await categoryExists(
        validation.data.id_kategori,
      );

      if (!categoryIsValid) {
        return res.status(404).json({
          success: false,
          message: "Kategori tidak ditemukan",
        });
      }

      if (req.file) {
        savedImage = await saveItemImage(req.file);
      }

      const updated = await updateItem(id, validation.data, savedImage);

      if (!updated) {
        if (savedImage) {
          await deleteUploadedFile(savedImage);
        }

        return res.status(404).json({
          success: false,
          message: "Item tidak ditemukan",
        });
      }

      if (savedImage && existing.image) {
        await deleteUploadedFile(existing.image);
      }

      return res.json({
        success: true,
        message: "Item berhasil diperbarui",
        data: updated,
      });
    } catch (error) {
      if (savedImage) {
        await deleteUploadedFile(savedImage);
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
          message: "Id item tidak valid",
        });
      }

      const existing = await findItemById(id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Item tidak ditemukan",
        });
      }

      await deleteItem(id);

      if (existing.image) {
        await deleteUploadedFile(existing.image);
      }

      return res.json({
        success: true,
        message: "Item berhasil dihapus",
        data: { id_items: id },
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new ItemController();
