import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} belum diisi`);
  }
  return value;
}

const port = Number(process.env.PORT ?? 8000);

export const env = {
  port,
  appUrl: (process.env.APP_URL ?? `http://localhost:${port}`).replace(
    /\/+$/,
    "",
  ),
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? "postgres",
    password: process.env.DB_PASS ?? "",
    database: process.env.DB_NAME ?? "aplikasi_caku",
  },
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1d",
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  },
  seed: {
    admin: {
      nama: process.env.SEED_ADMIN_NAMA ?? "Administrator Caku",
      email: process.env.SEED_ADMIN_EMAIL ?? "admin@caku.test",
      password: process.env.SEED_ADMIN_PASSWORD ?? "",
    },
    customer: {
      nama: process.env.SEED_CUSTOMER_NAMA ?? "Customer Caku",
      email: process.env.SEED_CUSTOMER_EMAIL ?? "customer@caku.test",
      password: process.env.SEED_CUSTOMER_PASSWORD ?? "",
    },
  },
};
