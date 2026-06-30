import fs from "node:fs";
import https from "node:https";
import cors from "cors";
import express from "express";
import { env } from "../config/env.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { apiRouter } from "../routes/index.js";

export function createServer() {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", apiRouter);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "not_found",
        message: "Route not found.",
      },
    });
  });

  app.use(errorHandler);

  if (env.HTTPS_ENABLED) {
    if (!env.HTTPS_CERT_PATH || !env.HTTPS_KEY_PATH) {
      throw new Error(
        "HTTPS is enabled but HTTPS_CERT_PATH or HTTPS_KEY_PATH is missing.",
      );
    }

    return https.createServer(
      {
        cert: fs.readFileSync(env.HTTPS_CERT_PATH),
        key: fs.readFileSync(env.HTTPS_KEY_PATH),
      },
      app,
    );
  }

  return app;
}
