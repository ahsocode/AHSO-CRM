type ConfigReader = {
  get<T = string>(key: string): T | undefined;
};

type EnvSource = ConfigReader | NodeJS.ProcessEnv;

function readConfigValue(source: EnvSource, key: string) {
  if ("get" in source && typeof source.get === "function") {
    return source.get<string>(key);
  }

  return (source as NodeJS.ProcessEnv)[key];
}

export function resolveAllowedCorsOrigins(source: EnvSource = process.env) {
  const configuredOrigins = (
    readConfigValue(source, "CORS_ORIGIN") ?? "http://localhost:3000,http://127.0.0.1:3000"
  )
    .split(",")
    .map((origin: string) => origin.trim())
    .filter(Boolean);
  const frontendUrl = readConfigValue(source, "FRONTEND_URL")?.trim();

  return Array.from(new Set([...configuredOrigins, ...(frontendUrl ? [frontendUrl] : [])]));
}

export function buildCorsOptions(source: EnvSource = process.env) {
  const origins = resolveAllowedCorsOrigins(source);

  return {
    origin: origins.length === 1 ? origins[0] : origins,
    credentials: true
  };
}
