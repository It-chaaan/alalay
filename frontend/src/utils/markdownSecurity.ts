export function isSafeMarkdownUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
