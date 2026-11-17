import { Router } from "express";
import rentalController from "../controllers/rental.controller.ts";
import { verifyToken } from "../middlewares/auth.middleware.ts";
import { requireRole } from "../middlewares/role.middleware.ts";
import { uploadTransferProof } from "../middlewares/upload.middleware.ts";

const router = Router();

router.get("/", verifyToken, rentalController.findAll);
router.get("/:id", verifyToken, rentalController.findById);

router.post(
  "/",
  verifyToken,
  requireRole("customer"),
  uploadTransferProof,
  rentalController.create,
);

router.delete(
  "/:id",
  verifyToken,
  requireRole("customer"),
  rentalController.remove,
);

router.patch(
  "/:id/status",
  verifyToken,
  requireRole("admin"),
  rentalController.updateStatus,
);

export default router;
