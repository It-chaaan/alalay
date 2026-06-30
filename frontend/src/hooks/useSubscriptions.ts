import { useApiQuery } from "./useApiQuery";
import type { Subscription } from "./types";

export function useSubscriptions() {
  return useApiQuery<Subscription[]>("/subscriptions");
}
