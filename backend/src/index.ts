import { createServer } from "./server.js";
import { env } from "./config/env.js";

const server = createServer();
const protocol = env.HTTPS_ENABLED ? "https" : "http";

server.listen(env.PORT, () => {
  console.log(`Server listening on ${protocol}://localhost:${env.PORT}`);
});
