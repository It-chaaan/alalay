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
