export type AiCredentialProvider = "anthropic" | "openai" | "gemini";
export type AiCredentialAuthMode = "api_key" | "oauth";

export interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}
