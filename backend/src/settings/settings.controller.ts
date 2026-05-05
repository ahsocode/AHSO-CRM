import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "src/common/decorators/public.decorator";
import { RequirePermissions } from "src/common/decorators/permissions.decorator";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { ZodValidationPipe } from "src/common/pipes/zod-validation.pipe";
import { SettingsService } from "./settings.service";
import {
  CompanySettingInput,
  CompanySettingSchema,
  PolicySettingInput,
  PolicySettingSchema
} from "./dto/update-setting.dto";

@ApiTags("settings")
@Controller("settings")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  /**
   * GET /settings
   * Get the authenticated admin settings bundle.
   */
  @ApiOperation({ summary: "GET /api/settings" })
  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions("settings.view")
  async getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  /**
   * GET /settings/company
   * Get company information
   */
  @Public()
  @ApiOperation({ summary: "GET /api/settings/company" })
  @Get("company")
  async getCompanyInfo() {
    return this.settingsService.getPublicCompanyInfo();
  }

  /**
   * GET /settings/public
   * Get the safe public settings bundle for unauthenticated screens.
   */
  @Public()
  @ApiOperation({ summary: "GET /api/settings/public" })
  @Get("public")
  async getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  /**
   * PATCH /settings/company
   * Update company information (admin-only)
   */
  @ApiOperation({ summary: "PATCH /api/settings/company" })
  @Patch("company")
  @UseGuards(PermissionsGuard)
  @RequirePermissions("settings.edit")
  async updateCompanyInfo(
    @Body(new ZodValidationPipe(CompanySettingSchema)) input: CompanySettingInput
  ) {
    return this.settingsService.updateCompanyInfo(input);
  }

  /**
   * GET /settings/policies
   * Get policy settings
   */
  @ApiOperation({ summary: "GET /api/settings/policies" })
  @Get("policies")
  @UseGuards(PermissionsGuard)
  @RequirePermissions("settings.view")
  async getPolicies() {
    return this.settingsService.getPolicies();
  }

  /**
   * PATCH /settings/policies
   * Update policy settings (admin-only)
   */
  @ApiOperation({ summary: "PATCH /api/settings/policies" })
  @Patch("policies")
  @UseGuards(PermissionsGuard)
  @RequirePermissions("settings.edit")
  async updatePolicies(
    @Body(new ZodValidationPipe(PolicySettingSchema)) input: PolicySettingInput
  ) {
    return this.settingsService.updatePolicies(input);
  }

  /**
   * GET /settings/logo
   * Get logo URL
   */
  @Public()
  @ApiOperation({ summary: "GET /api/settings/logo" })
  @Get("logo")
  async getLogoUrl() {
    return this.settingsService.getLogoUrl();
  }

  /**
   * GET /settings/:key
   * Get a specific setting by key
   */
  @ApiOperation({ summary: "GET /api/settings/:key" })
  @Get(":key")
  @UseGuards(PermissionsGuard)
  @RequirePermissions("settings.view")
  async getSetting(@Param("key") key: string) {
    return this.settingsService.getSetting(key);
  }

  /**
   * PATCH /settings/:key
   * Update a specific setting (admin-only)
   */
  @ApiOperation({ summary: "PATCH /api/settings/:key" })
  @Patch(":key")
  @UseGuards(PermissionsGuard)
  @RequirePermissions("settings.edit")
  async updateSetting(@Param("key") key: string, @Body("value") value: any) {
    return this.settingsService.upsertSetting(key, value);
  }
}
