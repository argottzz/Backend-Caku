import path from "node:path";
import multer from "multer";
import { AppError } from "../utils/app-error.ts";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_MIME_TYPES,
} from "../utils/file.ts";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const imageFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback,
) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (
    !ALLOWED_IMAGE_MIME_TYPES.includes(
      file.mimetype as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
    ) ||
    !ALLOWED_IMAGE_EXTENSIONS.includes(extension)
  ) {
    return callback(
      new AppError(
        "File harus berupa gambar JPG, JPEG, PNG, atau WEBP",
        400,
      ),
    );
  }

  callback(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: imageFilter,
});

const uploadCheckoutMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 2,
  },
  fileFilter: imageFilter,
});

export const uploadItemImage = upload.single("image");

export const uploadTransferProof = upload.single("bukti_transfer");

export const uploadProfileImage = upload.single("profile_image");

export const uploadRentalCheckout = uploadCheckoutMulter.fields([
  { name: "bukti_transfer", maxCount: 1 },
  { name: "identity_image", maxCount: 1 },
]);
