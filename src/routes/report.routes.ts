import { Router } from "express";
import reportController from "../controllers/report.controller.ts";
import { verifyToken } from "../middlewares/auth.middleware.ts";
import { requireRole } from "../middlewares/role.middleware.ts";

const router = Router();

router.get("/summary", verifyToken, requireRole("admin"), reportController.summary);

export default router;
