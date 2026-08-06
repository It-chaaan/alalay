const MAX_OCR_FILE_BYTES = 10 * 1024 * 1024;
const MAX_OCR_PIXELS = 40_000_000;

function hasBytes(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export async function validateAndNormalizeOcrFile(file: File) {
  if (file.size <= 0 || file.size > MAX_OCR_FILE_BYTES) {
    throw new Error("Receipt files must be between 1 byte and 10 MB.");
  }

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isJpeg = hasBytes(header, [0xff, 0xd8, 0xff]);
  const isPng = hasBytes(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isPdf = hasBytes(header, [0x25, 0x50, 0x44, 0x46, 0x2d]);

  if (isPdf) throw new Error("PDF receipts are not supported by the browser OCR scanner.");
  if (!isJpeg && !isPng) throw new Error("Unsupported or malformed image file.");

  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > MAX_OCR_PIXELS) throw new Error("Image dimensions are too large for safe OCR processing.");

    const scale = Math.min(1, 4000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to prepare image for OCR.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const normalized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!normalized) throw new Error("Unable to normalize image for OCR.");
    return new File([normalized], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
