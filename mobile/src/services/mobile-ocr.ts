import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { Block, TextLine } from '@infinitered/react-native-mlkit-text-recognition';
import { authenticatedApiRequest } from './api';
import type { ReceiptCandidate } from './receipt-parser';

export type MobileOcrLine = Pick<TextLine, 'text' | 'frame'>;
export type MobileOcrBlock = Pick<Block, 'text' | 'frame' | 'lines'>;
export type MobileOcrResult = { text: string; lines: MobileOcrLine[]; blocks: MobileOcrBlock[] };

export class MobileOcrUnavailableError extends Error {
  constructor() {
    super('Receipt text recognition is not available in this build. Install a development build with native OCR enabled.');
    this.name = 'MobileOcrUnavailableError';
  }
}

function isMissingNativeModule(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /requireNativeModule|RNMLKitTextRecognitionModule|native module/i.test(message);
}

export async function recognizeReceiptText(imageUri: string): Promise<MobileOcrResult> {
  if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo') {
    throw new MobileOcrUnavailableError();
  }
  // Keep the native module behind this adapter so the rest of the app never
  // depends on ML Kit's provider-specific response shape.
  try {
    const { recognizeText } = await import('@infinitered/react-native-mlkit-text-recognition');
    const result = await recognizeText(imageUri);
    const blocks = result.blocks.map((block) => ({ text: block.text, frame: block.frame, lines: block.lines }));
    const lines = blocks.flatMap((block) => block.lines.map((line) => ({ text: line.text, frame: line.frame })));
    return { text: result.text.trim(), lines, blocks };
  } catch (error) {
    if (isMissingNativeModule(error)) throw new MobileOcrUnavailableError();
    throw new Error('I could not read that receipt. Please retake the photo and try again.');
  }
}

/** Sends only normalized OCR text to the authenticated mobile parser path. */
export async function processMobileReceipt(result: MobileOcrResult): Promise<ReceiptCandidate> {
  const parsed = await authenticatedApiRequest<Omit<ReceiptCandidate, 'rawText'>>('/api/ocr/mobile/receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: result.text, lines: result.lines.map((line) => line.text) }),
  });
  return { ...parsed, rawText: result.text };
}
