import { createServer } from "./server.js";
import { env } from "./config/env.js";

const server = createServer();

server.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
