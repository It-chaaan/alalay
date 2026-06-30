import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { billsRouter } from "./bills.routes.js";
import { aiRouter } from "./ai.routes.js";
import { budgetRouter, dashboardRouter, reportsRouter } from "./analytics.routes.js";
import { ocrRouter } from "./ocr.routes.js";
import { incomeRouter } from "./income.routes.js";
import { resourceRouter } from "./resource.routes.js";
import { settingsRouter } from "./settings.routes.js";

export const apiRouter = Router();

apiRouter.use(requireAuth);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/bills", billsRouter);
apiRouter.use("/expenses", resourceRouter("expenses"));
apiRouter.use("/income", incomeRouter);
apiRouter.use("/subscriptions", resourceRouter("subscriptions"));
apiRouter.use("/savings-goals", resourceRouter("savings_goals"));
apiRouter.use("/budget", budgetRouter);
apiRouter.use("/reports", reportsRouter);
apiRouter.use("/users", settingsRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/ocr", ocrRouter);
