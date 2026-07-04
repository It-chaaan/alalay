export function normalizeExternalUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return null;
    }
  }
}

export function faviconUrl(value: string | null | undefined) {
  const normalized = normalizeExternalUrl(value);
  if (!normalized) {
    return null;
  }

  const url = new URL(normalized);
  return `${url.origin}/favicon.ico`;
}

export function openExternalLink(value: string | null | undefined) {
  const normalized = normalizeExternalUrl(value);
  if (!normalized) {
    return;
  }

  window.location.assign(normalized);
}
