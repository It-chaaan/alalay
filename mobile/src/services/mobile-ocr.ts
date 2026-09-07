import { authenticatedApiRequest, ApiRequestError } from './api';
import { File } from 'expo-file-system';
import { receiptUploadMetadata } from '@/utils/receipt-upload';

export type ReceiptCandidate = {
  merchant: string | null;
  total: number | null;
  currency: string | null;
  date: string | null;
  lineItems: { description: string; amount: number; confidence?: number }[];
  suggestedCategory: string | null;
  extraction?: {
    merchant: { confidence: number; requiresConfirmation: boolean };
    total: { confidence: number; requiresConfirmation: boolean };
    date: { confidence: number; requiresConfirmation: boolean };
    category: { confidence: number; requiresConfirmation: boolean };
    warnings: string[];
    overallConfidence: number;
  };
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
  const { filename } = receiptUploadMetadata(image);
  const form = new FormData();
  const file = new File(image.uri);
  form.append('image', file, filename);
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
