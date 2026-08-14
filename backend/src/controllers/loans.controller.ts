import type { Request, Response } from "express";
import { createLoan, listLoans, recordLoanPayment, writeOffLoan } from "../services/loans.service.js";
import { sendSuccess } from "../utils/api.js";
export async function list(req: Request, res: Response) { return sendSuccess(res, await listLoans(req.user!.id)); }
export async function create(req: Request, res: Response) { return sendSuccess(res, await createLoan(req.user!.id, req.validated?.body as never), 201); }
export async function payment(req: Request, res: Response) { return sendSuccess(res, await recordLoanPayment(req.user!.id, String(req.params.id), req.validated?.body as never), 201); }
export async function writeOff(req: Request, res: Response) { return sendSuccess(res, await writeOffLoan(req.user!.id, String(req.params.id))); }
