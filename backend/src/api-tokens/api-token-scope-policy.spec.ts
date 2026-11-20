import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { API_TOKEN_SCOPES } from "./api-token.constants";

const SRC_ROOT = join(__dirname, "..");
const FORBIDDEN = /confirm|cancel|approve|lock|reject|revoke|api-tokens|cost-price|costprice/i;

function controllers(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return controllers(full);
    return entry.endsWith(".controller.ts") ? [full] : [];
  });
}

describe("machine scope policy (static scan of all controllers)", () => {
  it("the scope whitelist has no confirm/cancel/approve/lock scope", () => {
    for (const scope of API_TOKEN_SCOPES) {
      expect(scope).not.toMatch(FORBIDDEN);
    }
  });

  it("@RequireScope is never class-level, never on confirm/cancel/approve/lock routes, and only uses whitelisted scopes", () => {
    const violations: string[] = [];

    for (const file of controllers(SRC_ROOT)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        if (!line.trim().startsWith("@RequireScope(")) return;

        const scopes = Array.from(line.matchAll(/"([^"]+)"/g)).map((m) => m[1]);
        for (const scope of scopes) {
          if (!(API_TOKEN_SCOPES as readonly string[]).includes(scope)) violations.push(`${file}:${index + 1} scope ${scope}`);
        }

        // Collect the decorator block + method signature that this annotation applies to.
        let end = index + 1;
        while (end < lines.length && lines[end].trim().startsWith("@")) end += 1;
        const target = lines.slice(index, end + 1).join("\n");

        if (/^\s*export\s+class\s/.test(lines[end] ?? "")) violations.push(`${file}:${index + 1} class-level @RequireScope`);
        if (FORBIDDEN.test(target)) violations.push(`${file}:${index + 1} annotates a privileged route`);
      });
    }

    expect(violations).toEqual([]);
  });

  it("api-tokens and period-lock controllers carry no @RequireScope", () => {
    for (const file of [join(SRC_ROOT, "api-tokens/api-tokens.controller.ts"), join(SRC_ROOT, "inventory-controls/period-lock.controller.ts")]) {
      expect(readFileSync(file, "utf8")).not.toContain("@RequireScope(");
    }
  });
});
