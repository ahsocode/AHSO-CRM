import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { AiProviderRegistry } from "../ai/providers/ai-provider-registry.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { Public } from "../common/decorators/public.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AiCredentialsService } from "./ai-credentials.service";
import {
  OAuthAuthorizeDto,
  OAuthCallbackDto,
  TestAiProviderDto,
  UpdateAiModelDto,
  UpsertApiKeyDto,
  aiProviderSchema,
  oauthAuthorizeSchema,
  oauthCallbackSchema,
  testAiProviderSchema,
  updateAiModelSchema,
  upsertApiKeySchema
} from "./dto/ai-credential.dto";

@ApiTags("ai-credentials")
@Controller("ai-credentials")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiCredentialsController {
  constructor(
    private readonly aiCredentialsService: AiCredentialsService,
    private readonly aiProviderRegistry: AiProviderRegistry
  ) {}

  @Get()
  @RequirePermissions("settings.view")
  @ApiOperation({ summary: "Liệt kê trạng thái credential AI provider" })
  list() {
    return this.aiCredentialsService.listStatus();
  }

  @Post(":provider/api-key")
  @RequirePermissions("settings.edit")
  @ApiOperation({ summary: "Lưu API key cho AI provider" })
  upsertApiKey(
    @Param("provider", new ZodValidationPipe(aiProviderSchema, "param")) provider: "anthropic" | "openai" | "gemini",
    @Body(new ZodValidationPipe(upsertApiKeySchema)) dto: UpsertApiKeyDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.aiCredentialsService.upsertApiKey(provider, dto.apiKey, user.sub, dto.scopes);
  }

  @Post(":provider/oauth/authorize")
  @RequirePermissions("settings.edit")
  @ApiOperation({ summary: "Tạo OAuth authorize URL cho AI provider" })
  createAuthorizeUrl(
    @Param("provider", new ZodValidationPipe(aiProviderSchema, "param")) provider: "anthropic" | "openai" | "gemini",
    @Body(new ZodValidationPipe(oauthAuthorizeSchema)) dto: OAuthAuthorizeDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.aiCredentialsService.createAuthorizeUrl(provider, dto.redirectUri, user.sub);
  }

  @Post(":provider/test")
  @RequirePermissions("settings.edit")
  @ApiOperation({ summary: "Kiểm tra kết nối AI provider" })
  testProvider(
    @Param("provider", new ZodValidationPipe(aiProviderSchema, "param")) provider: "anthropic" | "openai" | "gemini",
    @Body(new ZodValidationPipe(testAiProviderSchema)) dto: TestAiProviderDto
  ) {
    return this.aiProviderRegistry.testProvider(provider, dto.prompt);
  }

  @Patch(":provider/model")
  @RequirePermissions("settings.edit")
  @ApiOperation({ summary: "Cập nhật model override cho AI provider" })
  updateModel(
    @Param("provider", new ZodValidationPipe(aiProviderSchema, "param")) provider: "anthropic" | "openai" | "gemini",
    @Body(new ZodValidationPipe(updateAiModelSchema)) dto: UpdateAiModelDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.aiCredentialsService.updateModel(provider, dto.model, user.sub);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get("oauth/callback")
  @ApiOperation({ summary: "OAuth callback cho AI provider" })
  handleCallback(@Query(new ZodValidationPipe(oauthCallbackSchema, "query")) query: OAuthCallbackDto) {
    return this.aiCredentialsService.handleOAuthCallback(query.state, query.code);
  }

  @Delete(":provider")
  @RequirePermissions("settings.edit")
  @ApiOperation({ summary: "Xóa credential AI provider" })
  disconnect(
    @Param("provider", new ZodValidationPipe(aiProviderSchema, "param")) provider: "anthropic" | "openai" | "gemini"
  ) {
    return this.aiCredentialsService.disconnect(provider);
  }
}
