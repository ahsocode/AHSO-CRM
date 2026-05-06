"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

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

  const initials = name
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
