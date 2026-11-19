import { Router } from "express";
import adminApplicationRoutes from "./admin-application.routes.ts";
import authRoutes from "./auth.routes.ts";
import categoryRoutes from "./category.routes.ts";
import itemRoutes from "./item.routes.ts";
import rentalRoutes from "./rental.routes.ts";
import reportRoutes from "./report.routes.ts";

const router = Router();

router.use("/admin-applications", adminApplicationRoutes);
router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/items", itemRoutes);
router.use("/rentals", rentalRoutes);
router.use("/reports", reportRoutes);

export default router;
