"use client";

import type { ReactNode } from "react";

export function Field({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className ? `space-y-2 ${className}` : "space-y-2"}>{children}</div>;
}

export function Label({
  htmlFor,
  children
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-text-primary">
      {children}
    </label>
  );
}

export function ErrorText({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-danger">{message}</p>;
}
