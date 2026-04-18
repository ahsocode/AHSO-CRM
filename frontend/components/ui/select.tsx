"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md border border-border bg-bg-input px-4 py-2 text-sm text-text-primary outline-none transition focus:border-border-focus focus:ring-2 focus:ring-info/15",
        className
      )}
      {...props}
    />
  );
});

Select.displayName = "Select";

export { Select };
