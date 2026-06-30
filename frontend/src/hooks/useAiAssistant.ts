import { useApiQuery } from "./useApiQuery";

export function useAiAssistant() {
  return useApiQuery<{ status: string; message: string }>("/ai/status");
}
