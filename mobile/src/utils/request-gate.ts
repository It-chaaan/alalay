/** Shares an in-progress read so repeated effects cannot fan out identical requests. */
export function createRequestGate<T>() {
  let inFlight: Promise<T> | null = null;

  return (request: () => Promise<T>) => {
    if (inFlight) return inFlight;
    inFlight = request().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}

/** Identifies the newest request and invalidates pending work on unmount. */
export function createLatestRequestGuard() {
  let generation = 0;
  return {
    begin() {
      generation += 1;
      return generation;
    },
    isCurrent(requestGeneration: number) {
      return requestGeneration === generation;
    },
    invalidate() {
      generation += 1;
    },
  };
}
