import type { Request, Response } from "express";
import { aiStatus, chat, streamChat, type AiChatRequest } from "../services/ai.service.js";
import { sendSuccess } from "../utils/api.js";
import { randomUUID } from "node:crypto";

type ValidatedAiBody = {
  message: string;
  request_id?: string;
  language?: "en" | "fil";
  history?: AiChatRequest["history"];
};

export async function status(_req: Request, res: Response) {
  return sendSuccess(res, await aiStatus());
}

export async function sendMessage(req: Request, res: Response) {
  const body = req.validated?.body as ValidatedAiBody;

  return sendSuccess(res, await chat({
    userId: req.user!.id,
    message: body.message,
    requestId: body.request_id,
    language: body.language,
    history: body.history,
  }));
}

export async function streamMessage(req: Request, res: Response) {
  const body = req.validated?.body as ValidatedAiBody;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("\n");

  try {
    const result = await streamChat(
      {
        userId: req.user!.id,
        message: body.message,
        language: body.language,
        history: body.history,
      },
      async (token) => {
        res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
      },
    );

    res.write(`event: done\ndata: ${JSON.stringify(result)}\n\n`);
    res.end();
  } catch (error: unknown) {
    const correlationId = randomUUID();
    console.error(`[${correlationId}] AI stream failed`, error instanceof Error ? error.stack || error.message : error);
    res.write(`event: error\ndata: ${JSON.stringify({ message: "AI request failed.", correlationId })}\n\n`);
    res.end();
  }
}
