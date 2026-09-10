/** Allows one navigation request per resolved app state, until the route settles. */
export function createRedirectGuard() {
  let lastKey: string | null = null;
  return {
    shouldRedirect(key: string) {
      if (lastKey === key) return false;
      lastKey = key;
      return true;
    },
    reset() {
      lastKey = null;
    },
  };
}
