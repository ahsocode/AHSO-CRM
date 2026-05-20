import { z } from "zod";

export const aiProviderSchema = z.enum(["anthropic", "openai", "gemini"]);
export type AiCredentialProvider = z.infer<typeof aiProviderSchema>;

export const upsertApiKeySchema = z.object({
  apiKey: z.string().trim().min(1, "API key là bắt buộc"),
  scopes: z.array(z.string().trim().min(1)).default([])
});

export type UpsertApiKeyDto = z.infer<typeof upsertApiKeySchema>;

export const updateAiModelSchema = z.object({
  model: z.string().trim().min(1, "Model là bắt buộc").max(100)
});

export type UpdateAiModelDto = z.infer<typeof updateAiModelSchema>;

export const testAiProviderSchema = z.object({
  prompt: z.string().trim().max(500).optional()
});

export type TestAiProviderDto = z.infer<typeof testAiProviderSchema>;

export const oauthAuthorizeSchema = z.object({
  redirectUri: z.string().trim().url("redirectUri không hợp lệ")
});

export type OAuthAuthorizeDto = z.infer<typeof oauthAuthorizeSchema>;

export const oauthCallbackSchema = z.object({
  state: z.string().trim().min(16),
  code: z.string().trim().min(1)
});

export type OAuthCallbackDto = z.infer<typeof oauthCallbackSchema>;
