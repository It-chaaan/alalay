export async function capabilities() {
  return {
    status: "not_configured",
    supported_uploads: ["image/jpeg", "image/png", "application/pdf"],
    readable_fields: ["merchant", "date", "items", "total_amount", "payment_method"],
    message: "OCR processing is not configured yet. The upload UI is ready, but parsing needs an OCR provider or Edge Function.",
  };
}
