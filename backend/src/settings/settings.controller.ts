import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { ROLE_VALUES } from "src/common/constants/role.constants";
import { SettingsService } from "./settings.service";
import { CompanySettingInput, PolicySettingInput } from "./dto/update-setting.dto";

@Controller("settings")
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  /**
   * GET /settings
   * Get all settings (public, no auth required for now)
   */
  @Get()
  async getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  /**
   * GET /settings/company
   * Get company information
   */
  @Get("company")
  async getCompanyInfo() {
    return this.settingsService.getCompanyInfo();
  }

  /**
   * PATCH /settings/company
   * Update company information (admin-only)
   */
  @Patch("company")
  @UseGuards(JwtAuthGuard)
  @Roles(ROLE_VALUES[0]) // ADMIN only
  async updateCompanyInfo(@Body() input: CompanySettingInput) {
    return this.settingsService.updateCompanyInfo(input);
  }

  /**
   * GET /settings/policies
   * Get policy settings
   */
  @Get("policies")
  async getPolicies() {
    return this.settingsService.getPolicies();
  }

  /**
   * PATCH /settings/policies
   * Update policy settings (admin-only)
   */
  @Patch("policies")
  @UseGuards(JwtAuthGuard)
  @Roles(ROLE_VALUES[0]) // ADMIN only
  async updatePolicies(@Body() input: PolicySettingInput) {
    return this.settingsService.updatePolicies(input);
  }

  /**
   * GET /settings/logo
   * Get logo URL
   */
  @Get("logo")
  async getLogoUrl() {
    return this.settingsService.getLogoUrl();
  }

  /**
   * GET /settings/:key
   * Get a specific setting by key
   */
  @Get(":key")
  async getSetting(@Param("key") key: string) {
    return this.settingsService.getSetting(key);
  }

  /**
   * PATCH /settings/:key
   * Update a specific setting (admin-only)
   */
  @Patch(":key")
  @UseGuards(JwtAuthGuard)
  @Roles(ROLE_VALUES[0]) // ADMIN only
  async updateSetting(@Param("key") key: string, @Body("value") value: any) {
    return this.settingsService.upsertSetting(key, value);
  }
}
