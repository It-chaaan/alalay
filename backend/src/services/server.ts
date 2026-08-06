import fs from "node:fs";
import https from "node:https";
import cors from "cors";
import express from "express";
import { env } from "../config/env.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { apiRouter } from "../routes/index.js";

export function createServer() {
  const app = express();
  app.set("trust proxy", 1);

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use((_req, res, next) => {
    if (env.HTTPS_ENABLED) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      const forwardedProto = _req.header("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
      if (!_req.secure && forwardedProto !== "https") {
        res.status(403).json({
          success: false,
          error: { code: "https_required", message: "HTTPS is required." },
        });
        return;
      }
    }
    next();
  });
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

  if (env.HTTPS_TERMINATE_LOCALLY) {
    if (!env.HTTPS_CERT_PATH || !env.HTTPS_KEY_PATH) {
      throw new Error(
        "HTTPS_TERMINATE_LOCALLY is enabled but HTTPS_CERT_PATH or HTTPS_KEY_PATH is missing.",
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
