export function isSafeMarkdownUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const baseUrl = typeof window === 'undefined' ? 'https://alalay.local' : window.location.origin;
    const url = new URL(value, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
