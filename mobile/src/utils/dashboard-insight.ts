export type InsightLoadState = 'loading' | 'ready' | 'empty' | 'error';
export type InsightPresentation = 'loading' | 'content' | 'empty' | 'error';

/** Keeps server prose intact; rendering, rather than this boundary, controls wrapping. */
export function normalizeDashboardInsight(message?: string | null) {
  const value = message?.trim();
  return value || null;
}

export function insightPresentation(
  state: InsightLoadState,
  insight: string | null,
): InsightPresentation {
  if (state === 'loading') return 'loading';
  if (state === 'error') return 'error';
  return insight ? 'content' : 'empty';
}

/** Shares an in-progress request so navigating between Home and chat cannot duplicate it. */
export function createInsightRequestGate() {
  let inFlight: Promise<void> | null = null;
  return (request: () => Promise<void>) => {
    if (inFlight) return inFlight;
    inFlight = request().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
