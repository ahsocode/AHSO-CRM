import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ShellErrorBoundary } from "./shell-error-boundary";

export default function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ShellErrorBoundary>
      <DashboardShell>{children}</DashboardShell>
    </ShellErrorBoundary>
  );
}

