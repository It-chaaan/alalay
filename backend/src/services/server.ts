import http from "node:http";
import { handleHealthRoute } from "../routes/health.js";

export function createServer() {
  return http.createServer((req, res) => {
    if (req.url === "/health") {
      handleHealthRoute(req, res);
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "Backend is running",
        endpoints: ["/health"],
      }),
    );
  });
}
