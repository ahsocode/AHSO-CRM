type SwaggerConfigReader = {
  get<T = string>(key: string): T | undefined;
};

export function isSwaggerEnabled(config: SwaggerConfigReader) {
  const nodeEnv = config.get<string>("NODE_ENV") ?? "development";
  const explicitFlag = config.get<string>("SWAGGER_ENABLED");

  return explicitFlag === "true" || nodeEnv !== "production";
}
