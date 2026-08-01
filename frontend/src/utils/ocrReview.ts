export const OCR_LOW_CONFIDENCE_THRESHOLD = 60;

export function isLowConfidenceOcr(confidence: number): boolean {
  return confidence < OCR_LOW_CONFIDENCE_THRESHOLD;
}

export function shouldBlockOcrLogging(confidence: number, total: number): boolean {
  return isLowConfidenceOcr(confidence) && total <= 0;
}
