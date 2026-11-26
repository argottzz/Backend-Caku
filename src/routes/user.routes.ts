import { Router } from "express";
import userController from "../controllers/user.controller.ts";
import { verifyToken } from "../middlewares/auth.middleware.ts";
import { uploadProfileImage } from "../middlewares/upload.middleware.ts";

const router = Router();

// Customer dan admin memakai endpoint yang sama; akun ditentukan dari JWT.
router.patch("/me", verifyToken, userController.updateProfile);

router.patch(
  "/me/profile-image",
  verifyToken,
  uploadProfileImage,
  userController.updateProfileImage,
);

router.delete(
  "/me/profile-image",
  verifyToken,
  userController.removeProfileImage,
);

export default router;
