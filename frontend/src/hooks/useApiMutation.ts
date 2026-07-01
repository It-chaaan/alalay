import { useCallback, useState } from "react";
import { apiRequest } from "../lib/apiClient";

export function useApiMutation() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async function mutate<T>(path: string, options: RequestInit) {
    setIsSubmitting(true);
    setError(null);

    try {
      return await apiRequest<T>(path, options);
    } catch (mutationError: unknown) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to save your changes.",
      );
      throw mutationError;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return {
    mutate,
    isSubmitting,
    error,
    reset,
  };
}
