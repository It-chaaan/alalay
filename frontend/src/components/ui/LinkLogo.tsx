import { faviconUrl } from "../../utils/linkPreview";

export function LinkLogo({
  label,
  link,
  className,
  textClassName = "",
}: {
  label: string;
  link?: string | null;
  className: string;
  textClassName?: string;
}) {
  const logo = faviconUrl(link);
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden ${className}`}>
      <span className={textClassName}>{initial}</span>
      {logo ? (
        <img
          src={logo}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </span>
  );
}
