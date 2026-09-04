/**
 * Coarse progress percentage for a project pipeline stage. Shared by the
 * customers and projects services so the two never drift.
 */
export function projectProgressPercent(status: string): number {
  switch (status) {
    case "SURVEY":
      return 15;
    case "QUOTING":
      return 35;
    case "NEGOTIATING":
      return 60;
    case "WON":
      return 75;
    case "DELIVERING":
      return 85;
    case "COMPLETED":
      return 100;
    default:
      return 0;
  }
}
