import { useEffect, useState } from "react";
import { apiRequest } from "../lib/apiClient";

export type ApiQueryState<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
};

export function useApiQuery<T>(path: string) {
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<ApiQueryState<T>>({
    data: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    setState((current) => ({ ...current, isLoading: true, error: null }));

    apiRequest<T>(path)
      .then((data) => {
        if (isMounted) {
          setState({ data, isLoading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({ data: null, isLoading: false, error: error instanceof Error ? error.message : "Unable to load data." });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [path, reloadToken]);

  return {
    ...state,
    refetch: () => setReloadToken((current) => current + 1),
  };
}
