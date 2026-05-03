import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type IconName =
  | "dashboard"
  | "groups"
  | "factory"
  | "description"
  | "contract"
  | "calendar"
  | "analytics"
  | "settings"
  | "search"
  | "preview"
  | "bell"
  | "plus"
  | "arrow-right"
  | "arrow-left"
  | "clock"
  | "mail"
  | "phone"
  | "activity"
  | "logout"
  | "history"
  | "briefcase"
  | "chevron-down"
  | "monitor"
  | "map-pin";

const ICONS: Record<IconName, ReactNode> = {
  dashboard: <path d="M3 3h7v8H3zM14 3h7v5h-7zM14 11h7v10h-7zM3 14h7v7H3z" />,
  groups: <path d="M16 11c1.66 0 3-1.79 3-4s-1.34-4-3-4-3 1.79-3 4 1.34 4 3 4Zm-8 0c1.66 0 3-1.79 3-4S9.66 3 8 3 5 4.79 5 7s1.34 4 3 4Zm0 2c-2.67 0-8 1.34-8 4v4h10v-4c0-1.42.77-2.67 2.08-3.64A10.78 10.78 0 0 0 8 13Zm8 0c-.29 0-.62.02-.97.05 1.18.86 1.97 2.07 1.97 3.45v4H24v-4c0-2.66-5.33-4-8-4Z" />,
  factory: <path d="M2 21h20V9l-7 4V9l-7 4V3H2zM6 18h2v-2H6zm4 0h2v-2h-2zm4 0h2v-2h-2z" />,
  description: <path d="M6 2h9l5 5v15H6zM14 3v5h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  contract: <path d="M7 3h10l4 4v14H7zM13 3v5h5M10 14h8M10 18h8M10 10h3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  calendar: <path d="M7 2v4M17 2v4M3 9h18M4 5h16a1 1 0 0 1 1 1v14H3V6a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  analytics: <path d="M5 9h3v10H5zM10.5 5h3v14h-3zM16 12h3v7h-3z" />,
  settings: <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 1 0 12 8.5zm8.94 4.5a7.9 7.9 0 0 0 .06-1l2-1.56-2-3.46-2.42.49a8.31 8.31 0 0 0-.87-.5L15.5 2h-4l-.21 2.97c-.3.13-.59.29-.87.48L7.99 4.96 6 8.42 8 10a7.9 7.9 0 0 0 0 2l-2 1.58 1.99 3.46 2.43-.49c.27.19.56.35.86.49L11.5 22h4l.21-2.97c.3-.13.59-.29.87-.48l2.42.49L21 15.58 18.99 14c-.02-.33-.04-.66-.05-1Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  search: <path d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  preview: <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  bell: <path d="M6 8a6 6 0 1 1 12 0v5l2 3H4l2-3zm4 11a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  plus: <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  "arrow-right": <path d="M5 12h14M13 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  "arrow-left": <path d="M19 12H5M11 19l-7-7 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  briefcase: <path d="M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  clock: <path d="M12 7v5l3 3M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  mail: <path d="M3 6h18v12H3zM3 7l9 6 9-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  phone: <path d="M6.5 4h3l1.5 4-2 1.5a15 15 0 0 0 5.5 5.5L16 13l4 1.5v3a2 2 0 0 1-2.18 2A17 17 0 0 1 4.5 6.18 2 2 0 0 1 6.5 4Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  activity: <path d="M3 12h4l2-5 4 10 2-5h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  logout: <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  history: <path d="M12 3a9 9 0 0 1 9 9M3 12a9 9 0 0 1 9-9M9 12l3-3v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  "chevron-down": <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  monitor: <path d="M2 3h20v14H2zM8 21h8M12 17v4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  "map-pin": <path d="M12 2a6 6 0 0 1 6 6c0 4-6 14-6 14S6 12 6 8a6 6 0 0 1 6-6Zm0 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
};

export function AppIcon({
  name,
  className
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("h-4 w-4 shrink-0", className)}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
