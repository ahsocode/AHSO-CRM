import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const SRC_ROOT = join(__dirname, "..", "..");

function collectControllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      return collectControllerFiles(fullPath);
    }

    return entry.endsWith(".controller.ts") ? [fullPath] : [];
  });
}

function hasApiOperationForRoute(lines: string[], routeLineIndex: number) {
  for (let index = routeLineIndex; index >= 0; index -= 1) {
    const line = lines[index].trim();

    if (!line) {
      continue;
    }

    if (!line.startsWith("@")) {
      break;
    }

    if (line.startsWith("@ApiOperation")) {
      return true;
    }
  }

  for (let index = routeLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line) {
      continue;
    }

    if (!line.startsWith("@")) {
      break;
    }

    if (line.startsWith("@ApiOperation")) {
      return true;
    }
  }

  return false;
}

describe("Swagger controller coverage", () => {
  const controllerFiles = collectControllerFiles(SRC_ROOT);

  it("adds ApiTags to every controller", () => {
    const missingTags = controllerFiles
      .filter((file) => !readFileSync(file, "utf8").includes("@ApiTags("))
      .map((file) => file.replace(`${SRC_ROOT}/`, ""));

    expect(missingTags).toEqual([]);
  });

  it("adds ApiBearerAuth to guarded controllers", () => {
    const missingBearer = controllerFiles
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return source.includes("JwtAuthGuard") && !source.includes("@ApiBearerAuth(");
      })
      .map((file) => file.replace(`${SRC_ROOT}/`, ""));

    expect(missingBearer).toEqual([]);
  });

  it("adds ApiOperation to every HTTP route", () => {
    const missingOperations: string[] = [];

    for (const file of controllerFiles) {
      const lines = readFileSync(file, "utf8").split("\n");

      lines.forEach((line, index) => {
        if (/^\s*@(Get|Post|Patch|Delete|Put)\(/.test(line) && !hasApiOperationForRoute(lines, index)) {
          missingOperations.push(`${file.replace(`${SRC_ROOT}/`, "")}:${index + 1}`);
        }
      });
    }

    expect(missingOperations).toEqual([]);
  });
});
