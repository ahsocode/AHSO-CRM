"""Conservative decorator checks for NestJS HTTP controllers, without a TS dependency."""
from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from pathlib import Path

HTTP_METHODS = {"Get", "Post", "Patch", "Put", "Delete"}
AUTHORIZATION = {"RequirePermissions", "RequireAnyPermissions", "Roles"}
# These entry points establish/recover a session, so they cannot require a JWT.
PUBLIC_AUTH_PATHS = {"login", "refresh", "forgot-password", "reset-password"}
AUTH_CONTROLLER = "backend/src/auth/auth.controller.ts"
# Infrastructure probes must work without a signed-in user.
HEALTH_CONTROLLER = "backend/src/health/health.controller.ts"


@dataclass(frozen=True)
class Decorator:
    name: str
    start: int
    end: int
    arguments: str
    code_arguments: str


def mask_comments_and_strings(source: str) -> str:
    """Preserve positions/newlines while hiding decorator-like prose and delimiters."""
    chars = list(source)
    index = 0
    while index < len(source):
        start = index
        if source.startswith("//", index):
            index = source.find("\n", index)
            if index < 0:
                index = len(source)
        elif source.startswith("/*", index):
            closing = source.find("*/", index + 2)
            index = len(source) if closing < 0 else closing + 2
        elif source[index] in "\"'`":
            quote = source[index]
            index += 1
            while index < len(source):
                if source[index] == "\\":
                    index += 2
                elif source[index] == quote:
                    index += 1
                    break
                else:
                    index += 1
        else:
            index += 1
            continue
        for position in range(start, min(index, len(source))):
            if chars[position] != "\n":
                chars[position] = " "
    return "".join(chars)


def matching_end(code: str, start: int, opening: str, closing: str) -> int:
    depth = 0
    for index in range(start, len(code)):
        if code[index] == opening:
            depth += 1
        elif code[index] == closing:
            depth -= 1
            if depth == 0:
                return index + 1
    return len(code)


def decorators(source: str, code: str) -> list[Decorator]:
    result = []
    for match in re.finditer(r"@([A-Za-z_$][\w$]*)\s*\(", code):
        opening = match.end() - 1
        end = matching_end(code, opening, "(", ")")
        result.append(Decorator(match.group(1), match.start(), end,
                                source[opening + 1:end - 1], code[opening + 1:end - 1]))
    return result


def preceding_block(items: list[Decorator], code: str, position: int) -> list[Decorator]:
    result = []
    for item in reversed(items):
        if item.end > position:
            continue
        if code[item.end:position].strip():
            break
        result.append(item)
        position = item.start
    return list(reversed(result))


def route_block(items: list[Decorator], code: str, route: Decorator) -> list[Decorator]:
    result = preceding_block(items, code, route.start) + [route]
    position = route.end
    for item in items:
        if item.start < position:
            continue
        if code[position:item.start].strip():
            break
        result.append(item)
        position = item.end
    return result


def literal_path(arguments: str) -> str:
    value = arguments.strip().rstrip(",").strip()
    if not value:
        return ""
    if value.startswith("`") and value.endswith("`") and "${" not in value:
        return value[1:-1]
    try:
        parsed = ast.literal_eval(value)
        if isinstance(parsed, str):
            return parsed
    except (ValueError, SyntaxError):
        pass
    # Dynamic/array paths must not accidentally match the public-route whitelist.
    return "<dynamic>"


def check_controller_guards(root: Path) -> list[str]:
    findings = []
    for file in sorted((root / "backend/src").rglob("*.controller.ts")):
        if file.name.startswith("._"):
            continue
        source = file.read_text(encoding="utf-8", errors="ignore")
        code = mask_comments_and_strings(source)
        items = decorators(source, code)
        relative = file.relative_to(root).as_posix()
        classes = []
        for declaration in re.finditer(r"\bexport\s+(?:default\s+)?(?:abstract\s+)?class\s+\w+", code):
            opening = code.find("{", declaration.end())
            if opening < 0:
                continue
            block = preceding_block(items, code, declaration.start())
            class_line = code.count("\n", 0, declaration.start()) + 1
            guards = [item for item in block if item.name == "UseGuards"
                      and code.count("\n", 0, item.start) + 1 >= class_line - 5]
            controller = next((item for item in block if item.name == "Controller"), None)
            classes.append((opening, matching_end(code, opening, "{", "}"), block,
                            guards, literal_path(controller.arguments) if controller else ""))

        for route in (item for item in items if item.name in HTTP_METHODS):
            containing = [entry for entry in classes if entry[0] < route.start < entry[1]]
            if not containing:
                continue
            _, _, class_block, class_guards, prefix = min(containing, key=lambda entry: entry[1] - entry[0])
            block = route_block(items, code, route)
            path = literal_path(route.arguments)
            method = route.name.upper()
            line = code.count("\n", 0, route.start) + 1
            route_path = "/" + "/".join(part.strip("/") for part in (prefix, path) if part.strip("/"))
            location = f"{relative}:{line}  {method} {route_path}"
            public = any(item.name == "Public" for item in class_block + block)
            whitelisted = relative == HEALTH_CONTROLLER or (
                relative == AUTH_CONTROLLER and prefix == "auth" and method == "POST" and path in PUBLIC_AUTH_PATHS
            )
            method_guards = [item for item in block if item.name == "UseGuards"]
            if public or whitelisted:
                continue
            if not class_guards and not method_guards:
                findings.append(f"ERROR guard    {location}")
                continue
            jwt_class = any(re.search(r"\bJwtAuthGuard\b", item.code_arguments) for item in class_guards)
            if jwt_class and not any(item.name in AUTHORIZATION for item in class_block + block):
                findings.append(f"WARN  guard    {location} — missing permission/role metadata")
    return findings
