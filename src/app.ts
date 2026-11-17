import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.ts";
import { errorHandler } from "./middlewares/error.middleware.ts";
import { notFoundHandler } from "./middlewares/not-found.middleware.ts";
import routes from "./routes/index.ts";

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(cors({ origin: env.corsOrigins }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server berjalan",
    data: { status: "ok" },
  });
});

app.use("/api", routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
