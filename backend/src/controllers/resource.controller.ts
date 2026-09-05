import type { Request, Response } from "express";
import { makeResourceService } from "../services/resource.service.js";
import { getSavingsDashboard } from "../services/analytics.service.js";
import type { TableName } from "../services/db.js";
import { sendSuccess } from "../utils/api.js";
import { client, throwIfError } from "../services/db.js";

export async function savingsDashboard(req: Request, res: Response) {
  return sendSuccess(res, await getSavingsDashboard(req.user!.id));
}

export async function addGoalContribution(req: Request, res: Response) {
  const body = req.validated?.body as { wallet_id: string; amount: number; contribution_date: string; note?: string; idempotency_key: string };
  const { data, error } = await client().rpc("add_goal_contribution", {
    target_goal_id: (req.validated?.params as { id: string }).id,
    source_wallet_id: body.wallet_id,
    contribution_amount: body.amount,
    contribution_on: body.contribution_date,
    contribution_note: body.note ?? null,
    request_id: body.idempotency_key,
  });
  throwIfError(error);
  return sendSuccess(res, data);
}

export async function releaseGoalContribution(req: Request, res: Response) {
  const body = req.validated?.body as { contribution_id: string; amount: number; release_date?: string; note?: string; idempotency_key: string };
  const { data, error } = await client().rpc("release_goal_contribution", {
    target_contribution_id: body.contribution_id,
    release_amount: body.amount,
    released_on_value: body.release_date ?? null,
    release_note: body.note ?? null,
    request_id: body.idempotency_key,
  });
  throwIfError(error);
  return sendSuccess(res, data);
}

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
