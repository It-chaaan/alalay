import { useApiQuery } from "./useApiQuery";

export function useOcrScanner() {
  return useApiQuery<{ status: string; message: string; supported_uploads: string[]; readable_fields: string[] }>("/ocr/capabilities");
}
