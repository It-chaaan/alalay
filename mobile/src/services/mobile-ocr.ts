import { authenticatedApiRequest, ApiRequestError } from './api';

export type ReceiptCandidate = {
  merchant: string | null;
  total: number | null;
  currency: string | null;
  date: string | null;
  lineItems: { description: string; amount: number }[];
  suggestedCategory: string | null;
};

export type ServerReceiptScan = {
  success: true;
  ocr: { rawText: string; confidence: number | null };
  receipt: ReceiptCandidate;
  image: { retained: false };
  metadata: { engine: 'tesseract.js'; processingMs: number };
};

export class ReceiptUploadError extends Error {
  constructor(message: string, public readonly kind: 'network' | 'ocr' | 'upload') { super(message); }
}

/** Uploads the selected local image. OCR stays exclusively on the authenticated server. */
export async function scanReceiptImage(image: { uri: string; mimeType?: string | null }, signal?: AbortSignal): Promise<ServerReceiptScan> {
  const type = image.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  const form = new FormData();
  form.append('image', { uri: image.uri, name: `receipt.${type === 'image/png' ? 'png' : 'jpg'}`, type } as never);
  try {
    return await authenticatedApiRequest<ServerReceiptScan>('/api/ocr/receipt', { method: 'POST', body: form, signal });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.code === 'network_error' || error.code === 'network_error_after_refresh') throw new ReceiptUploadError("We couldn't upload this receipt. Check your connection and try again.", 'network');
      if (error.code === 'ocr_failed' || error.code === 'ocr_timeout') throw new ReceiptUploadError("We couldn't read this receipt. Try taking a clearer photo.", 'ocr');
      throw new ReceiptUploadError(error.message, 'upload');
    }
    throw new ReceiptUploadError("We couldn't upload this receipt. Check your connection and try again.", 'network');
  }
}
