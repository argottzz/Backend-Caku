import { Router } from "express";
import itemController from "../controllers/item.controller.ts";
import { verifyToken } from "../middlewares/auth.middleware.ts";
import { requireRole } from "../middlewares/role.middleware.ts";
import { uploadItemImage } from "../middlewares/upload.middleware.ts";

const router = Router();

router.get("/", verifyToken, itemController.findAll);
router.get("/:id", verifyToken, itemController.findById);

router.post(
  "/",
  verifyToken,
  requireRole("admin"),
  uploadItemImage,
  itemController.create,
);

router.put(
  "/:id",
  verifyToken,
  requireRole("admin"),
  uploadItemImage,
  itemController.update,
);

router.delete("/:id", verifyToken, requireRole("admin"), itemController.remove);

export default router;
