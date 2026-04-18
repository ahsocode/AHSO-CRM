"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md border border-border bg-bg-input px-4 py-2 text-sm text-text-primary outline-none transition focus:border-border-focus focus:ring-2 focus:ring-info/15 placeholder:text-text-muted",
        className
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";

export { Input };

