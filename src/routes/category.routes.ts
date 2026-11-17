import { Router } from "express";
import categoryController from "../controllers/category.controller.ts";
import { verifyToken } from "../middlewares/auth.middleware.ts";

const router = Router();

router.get("/", verifyToken, categoryController.findAll);

export default router;
