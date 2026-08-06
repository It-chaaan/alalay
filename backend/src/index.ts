import { createServer } from "./server.js";
import { env } from "./config/env.js";
import { startNotificationScheduler } from "./services/notification-scheduler.service.js";
import { startBillingScheduler } from "./services/billing-scheduler.service.js";

const app = createServer();
const protocol = env.HTTPS_TERMINATE_LOCALLY ? "https" : "http";
const address = `${protocol}://localhost:${env.PORT}`;

const server = app.listen(env.PORT, () => {
  console.log(`Server listening on ${address}`);
  startBillingScheduler();
  startNotificationScheduler();
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${env.PORT} is already in use. Stop the existing backend or choose a different PORT.`);
    process.exit(1);
  }

  console.error("Backend failed to start:", error);
  process.exit(1);
});
