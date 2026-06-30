import type { Request, Response } from "express";
import { createBill, deleteBill, getBill, listBills, payBill, updateBill } from "../services/bills.service.js";
import { sendSuccess } from "../utils/api.js";

export async function list(req: Request, res: Response) {
  const data = await listBills(req.user!.id, (req.validated?.query ?? {}) as { status?: string; due_within_days?: number; category?: string });
  return sendSuccess(res, data);
}

export async function get(req: Request, res: Response) {
  const data = await getBill(req.user!.id, (req.validated?.params as { id: string }).id);
  return sendSuccess(res, data);
}

export async function create(req: Request, res: Response) {
  const data = await createBill(req.user!.id, req.validated?.body as Record<string, unknown>);
  return sendSuccess(res, data, 201);
}

export async function update(req: Request, res: Response) {
  const data = await updateBill(req.user!.id, (req.validated?.params as { id: string }).id, req.validated?.body as Record<string, unknown>);
  return sendSuccess(res, data);
}

export async function remove(req: Request, res: Response) {
  const data = await deleteBill(req.user!.id, (req.validated?.params as { id: string }).id);
  return sendSuccess(res, data);
}

export async function pay(req: Request, res: Response) {
  const data = await payBill(req.user!.id, (req.validated?.params as { id: string }).id);
  return sendSuccess(res, data);
}
