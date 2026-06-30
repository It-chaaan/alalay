import type { AuthedUser } from "./index.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export {};
