import { Router } from "express";
import adminApplicationController from "../controllers/admin-application.controller.ts";
import { verifyToken } from "../middlewares/auth.middleware.ts";
import { requireRole } from "../middlewares/role.middleware.ts";

const router = Router();

router.post(
  "/",
  verifyToken,
  requireRole("customer"),
  adminApplicationController.apply,
);

router.get("/me", verifyToken, adminApplicationController.me);

router.get(
  "/",
  verifyToken,
  requireRole("admin"),
  adminApplicationController.findAll,
);

router.get(
  "/:id",
  verifyToken,
  requireRole("admin"),
  adminApplicationController.findById,
);

router.patch(
  "/:id/approve",
  verifyToken,
  requireRole("admin"),
  adminApplicationController.approve,
);

router.patch(
  "/:id/reject",
  verifyToken,
  requireRole("admin"),
  adminApplicationController.reject,
);

export default router;
