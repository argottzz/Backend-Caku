import { Router } from "express";
import rentalController from "../controllers/rental.controller.ts";
import { verifyToken } from "../middlewares/auth.middleware.ts";
import { requireRole } from "../middlewares/role.middleware.ts";
import { uploadRentalCheckout } from "../middlewares/upload.middleware.ts";

const router = Router();

router.get("/", verifyToken, rentalController.findAll);
router.get("/:id", verifyToken, rentalController.findById);

router.post(
  "/",
  verifyToken,
  requireRole("customer"),
  uploadRentalCheckout,
  rentalController.create,
);

router.post(
  "/pay-qr",
  verifyToken,
  rentalController.payQr,
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

router.post(
  "/:id/return",
  verifyToken,
  requireRole("admin"),
  rentalController.returnRental,
);

router.patch(
  "/:id/replacement",
  verifyToken,
  requireRole("admin"),
  rentalController.completeReplacement,
);

export default router;
