import type { Request, Response } from "express";
import { makeResourceService } from "../services/resource.service.js";
import type { TableName } from "../services/db.js";
import { sendSuccess } from "../utils/api.js";

export function makeResourceController(table: TableName) {
  const service = makeResourceService(table);

  return {
    list: async (req: Request, res: Response) => {
      const data = await service.list(req.user!.id, req.validated?.query as Record<string, unknown> | undefined);
      return sendSuccess(res, data);
    },
    get: async (req: Request, res: Response) => {
      const data = await service.get(req.user!.id, (req.validated?.params as { id: string }).id);
      return sendSuccess(res, data);
    },
    create: async (req: Request, res: Response) => {
      const data = await service.create(req.user!.id, req.validated?.body as Record<string, unknown>);
      return sendSuccess(res, data, 201);
    },
    update: async (req: Request, res: Response) => {
      const data = await service.update(req.user!.id, (req.validated?.params as { id: string }).id, req.validated?.body as Record<string, unknown>);
      return sendSuccess(res, data);
    },
    remove: async (req: Request, res: Response) => {
      const data = await service.remove(req.user!.id, (req.validated?.params as { id: string }).id);
      return sendSuccess(res, data);
    },
  };
}
