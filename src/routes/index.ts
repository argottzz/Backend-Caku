import { Router } from "express";
import authRoutes from "./auth.routes.ts";
import categoryRoutes from "./category.routes.ts";
import itemRoutes from "./item.routes.ts";
import rentalRoutes from "./rental.routes.ts";

const router = Router();

router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/items", itemRoutes);
router.use("/rentals", rentalRoutes);

export default router;
