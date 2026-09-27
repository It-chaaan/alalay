import { createServer } from './server.js';
import { env, inProcessSchedulersEnabled } from './config/env.js';
import { startNotificationScheduler } from './services/notification-scheduler.service.js';
import { startBillingScheduler } from './services/billing-scheduler.service.js';
import { startIncomeScheduler } from './services/income-scheduler.service.js';

const app = createServer();
const protocol = env.HTTPS_TERMINATE_LOCALLY ? 'https' : 'http';
const host = '0.0.0.0';
const address = `${protocol}://${host}:${env.PORT}`;

const server = app.listen(env.PORT, host, () => {
  console.log(`Server listening on ${address}`);
  if (inProcessSchedulersEnabled) {
    startBillingScheduler();
    startIncomeScheduler();
    startNotificationScheduler();
  } else {
    console.log('In-process schedulers disabled; configure a durable external scheduler.');
  }
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${env.PORT} is already in use. Stop the existing backend or choose a different PORT.`,
    );
    process.exit(1);
  }

  console.error('Backend failed to start:', error);
  process.exit(1);
});

let shuttingDown = false;
function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; closing HTTP server.`);

  server.close(() => process.exit(0));
  server.closeIdleConnections();
  setTimeout(() => {
    console.error('HTTP server did not close before the shutdown timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
