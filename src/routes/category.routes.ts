import { Router } from "express";
import categoryController from "../controllers/category.controller.ts";
import { verifyToken } from "../middlewares/auth.middleware.ts";
import { requireRole } from "../middlewares/role.middleware.ts";

const router = Router();

// Daftar kategori dibutuhkan form barang dan filter katalog, sehingga tetap
// dapat dibaca semua pengguna yang sudah login.
router.get("/", verifyToken, categoryController.findAll);

router.post(
  "/",
  verifyToken,
  requireRole("admin"),
  categoryController.create,
);

router.patch(
  "/:id",
  verifyToken,
  requireRole("admin"),
  categoryController.update,
);

router.put(
  "/:id",
  verifyToken,
  requireRole("admin"),
  categoryController.update,
);

router.delete(
  "/:id",
  verifyToken,
  requireRole("admin"),
  categoryController.remove,
);

export default router;
