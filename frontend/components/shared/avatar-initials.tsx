"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const LEGAL_PREFIX = /^(công ty|cty|tnhh|cổ phần|cp|mtv|tmdv|tm|dv|hộ kinh doanh|tập đoàn|chi nhánh|doanh nghiệp tư nhân|dntn|một thành viên|thương mại|dịch vụ|sản xuất)\s+/i;

// Strip Vietnamese legal-form prefixes (e.g. "Công ty TNHH") so initials reflect the brand name.
// Falls back to the trimmed original name if stripping would leave an empty string.
export function stripLegalPrefix(name: string): string {
  const trimmed = name.trim();
  let base = trimmed;
  while (LEGAL_PREFIX.test(base)) base = base.replace(LEGAL_PREFIX, "");
  return base.trim() ? base : trimmed;
}

export function AvatarInitials({
  name,
  className,
  src
}: {
  name: string;
  className?: string;
  src?: string | null;
}) {
  const [imgError, setImgError] = useState(false);

  // Reset error state when src changes (e.g. user uploads a new avatar).
  useEffect(() => {
    setImgError(false);
  }, [src]);

  const initials = stripLegalPrefix(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const classNames = cn(
    "flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-primary/10 font-heading text-sm font-bold text-primary",
    className
  );

  if (src && !imgError) {
    return (
      // Intentional <img>: the avatar src is frequently a cross-origin backend
      // URL or a blob: preview, and the render size is caller-controlled via
      // `className`. next/image would need per-caller width/height plus
      // remotePatterns config for the (env-derived) backend origin, with no
      // real benefit at avatar sizes.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn(classNames, "object-cover")}
        onError={() => setImgError(true)}
      />
    );
  }

  return <div className={classNames}>{initials}</div>;
}
