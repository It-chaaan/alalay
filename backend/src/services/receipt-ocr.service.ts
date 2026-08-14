import { createWorker, type Worker } from "tesseract.js";
import { parseReceiptText } from "./receipt-parser.service.js";

export type OcrReceiptResult = {
  rawText: string;
  confidence: number | null;
  receipt: ReturnType<typeof parseReceiptText>;
  metadata: { engine: "tesseract.js"; processingMs: number };
};

let workerPromise: Promise<Worker> | null = null;
let queue = Promise.resolve();
const OCR_TIMEOUT_MS = 45_000;

async function worker() {
  workerPromise ??= createWorker("eng", 1, { logger: () => undefined });
  return workerPromise;
}

function withTimeout<T>(task: Promise<T>, timeoutMs: number) {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ReceiptOcrTimeoutError()), timeoutMs); });
  return Promise.race([task, timeout]).finally(() => { if (timer) clearTimeout(timer); });
}

export class ReceiptOcrTimeoutError extends Error {
  constructor() { super("Receipt OCR timed out"); this.name = "ReceiptOcrTimeoutError"; }
}

/** A single reused worker bounds this process to one CPU/memory-intensive OCR job at a time. */
export async function recognizeReceiptImage(image: Buffer): Promise<OcrReceiptResult> {
  const startedAt = Date.now();
  const task = queue.then(async () => {
    const result = await (await worker()).recognize(image);
    return result.data;
  });
  // Keep the queue alive after failures and never start unbounded workers.
  queue = task.then(() => undefined, () => undefined);
  const data = await withTimeout(task, OCR_TIMEOUT_MS);
  const rawText = data.text.trim();
  return { rawText, confidence: Number.isFinite(data.confidence) ? data.confidence : null, receipt: parseReceiptText(rawText), metadata: { engine: "tesseract.js", processingMs: Date.now() - startedAt } };
}
