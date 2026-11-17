import { Router } from "express";
import authRoutes from "./auth.routes.ts";
import categoryRoutes from "./category.routes.ts";

const router = Router();

router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);

export default router;
