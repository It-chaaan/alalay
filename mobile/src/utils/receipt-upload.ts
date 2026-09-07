export function receiptUploadMetadata(image: { uri: string; mimeType?: string | null }) {
  const type = image.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  return { type, filename: `receipt.${type === 'image/png' ? 'png' : 'jpg'}` } as const;
}
