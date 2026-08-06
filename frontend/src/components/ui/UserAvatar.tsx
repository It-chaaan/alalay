import { useEffect, useState } from "react";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "JD";
}

export function UserAvatar({ url, name, size = "small", alt = "" }: { url?: string | null; name: string; size?: "small" | "large"; alt?: string }) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = url || "";
  const isLoaded = Boolean(imageUrl && loadedUrl === imageUrl && failedUrl !== imageUrl);
  const sizeClass = size === "large" ? "h-16 w-16 text-lg" : "h-7 w-7 text-xs";

  useEffect(() => {
    setLoadedUrl(null);
    setFailedUrl(null);
  }, [imageUrl]);

  return (
    <span className={`relative grid ${sizeClass} place-items-center overflow-hidden rounded-full bg-brand-primary font-bold text-white`}>
      {!isLoaded ? <span aria-hidden="true">{initials(name)}</span> : null}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          onLoad={() => setLoadedUrl(imageUrl)}
          onError={() => setFailedUrl(imageUrl)}
          className={`absolute inset-0 h-full w-full object-cover ${isLoaded ? "" : "invisible"}`}
        />
      ) : null}
    </span>
  );
}
