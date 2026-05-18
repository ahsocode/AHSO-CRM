import { Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { BackupService } from "./backup.service";

@ApiTags("backup")
@Controller("admin/backup")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("settings.edit")
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @ApiOperation({ summary: "List all backups on Google Drive" })
  @Get()
  listBackups() {
    return this.backupService.listBackups();
  }

  @ApiOperation({ summary: "Trigger a manual backup now" })
  @Post()
  @HttpCode(200)
  async createBackup() {
    await this.backupService.createBackup();
    return { success: true, message: "Sao lưu hoàn tất." };
  }

  @ApiOperation({ summary: "Restore from a specific backup file" })
  @Post(":filename/restore")
  @HttpCode(200)
  async restoreBackup(@Param("filename") filename: string) {
    await this.backupService.restoreBackup(filename);
    return { success: true, message: "Khôi phục hoàn tất. Vui lòng đăng nhập lại." };
  }

  @ApiOperation({ summary: "Delete a backup file from Google Drive" })
  @Delete(":filename")
  @HttpCode(200)
  async deleteBackup(@Param("filename") filename: string) {
    await this.backupService.deleteBackup(filename);
    return { success: true, message: "Đã xóa bản sao lưu." };
  }
}
