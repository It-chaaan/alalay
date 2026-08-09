import type { Request, Response } from "express";
import { createWallet, deleteWallet, getWallet, listWallets, updateWallet } from "../services/wallets.service.js";
import { sendSuccess } from "../utils/api.js";

export async function list(req: Request, res: Response) { return sendSuccess(res, await listWallets(req.user!.id)); }
export async function get(req: Request, res: Response) { return sendSuccess(res, await getWallet(req.user!.id, (req.validated?.params as { id: string }).id)); }
export async function create(req: Request, res: Response) { return sendSuccess(res, await createWallet(req.user!.id, req.validated?.body as never), 201); }
export async function update(req: Request, res: Response) { return sendSuccess(res, await updateWallet(req.user!.id, (req.validated?.params as { id: string }).id, req.validated?.body as Record<string, unknown>)); }
export async function remove(req: Request, res: Response) { return sendSuccess(res, await deleteWallet(req.user!.id, (req.validated?.params as { id: string }).id)); }
