import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface BackupFile {
  name: string;
  size: number;
  modTime: string;
  sizeHuman: string;
}

const FILENAME_RE = /^ahso-crm-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.tar\.gz$/;
const RCLONE_REMOTE = "AHSO-CRM-Backup:AHSO-CRM-Backups";
const BACKUP_SCRIPT = "/opt/backup-ahso-crm.sh";
const APP_DIR = "/opt/AHSO-CRM";

function humanSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly config: ConfigService) {}

  private get pg() {
    return {
      container: this.config.get<string>("POSTGRES_CONTAINER") ?? "ahso-crm-postgres-1",
      user: this.config.get<string>("POSTGRES_USER") ?? "ahso",
      db: this.config.get<string>("POSTGRES_DB") ?? "ahso_crm",
      password: this.config.get<string>("POSTGRES_PASSWORD") ?? ""
    };
  }

  async listBackups(): Promise<BackupFile[]> {
    try {
      const { stdout } = await execAsync(`rclone lsjson "${RCLONE_REMOTE}/"`);
      const files: Array<{ Name: string; Size: number; ModTime: string }> = JSON.parse(stdout || "[]");
      return files
        .filter((f) => FILENAME_RE.test(f.Name))
        .sort((a, b) => b.ModTime.localeCompare(a.ModTime))
        .map((f) => ({ name: f.Name, size: f.Size, modTime: f.ModTime, sizeHuman: humanSize(f.Size) }));
    } catch (err) {
      this.logger.warn(`listBackups failed: ${String(err)}`);
      return [];
    }
  }

  async createBackup(): Promise<void> {
    this.logger.log("Starting manual backup...");
    await execAsync(BACKUP_SCRIPT, { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 });
    this.logger.log("Manual backup complete.");
  }

  async restoreBackup(filename: string): Promise<void> {
    if (!FILENAME_RE.test(filename)) {
      throw new BadRequestException("Tên file không hợp lệ.");
    }

    const { container, user, db, password } = this.pg;
    const restoreDir = `/opt/backups/restore-${Date.now()}`;
    const extractedDir = filename.replace(".tar.gz", "");
    const pgEnv = `PGPASSWORD=${password}`;

    try {
      this.logger.log(`Restoring from ${filename}...`);

      await execAsync(`mkdir -p "${restoreDir}"`);

      // Download from Google Drive
      await execAsync(`rclone copy "${RCLONE_REMOTE}/${filename}" "${restoreDir}/"`, {
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024
      });

      // Extract
      await execAsync(`cd "${restoreDir}" && tar -xzf "${filename}"`);

      // Drop and recreate database
      await execAsync(`docker exec -e ${pgEnv} ${container} psql -U ${user} -c "DROP DATABASE IF EXISTS ${db};"`);
      await execAsync(`docker exec -e ${pgEnv} ${container} psql -U ${user} -c "CREATE DATABASE ${db};"`);

      // Restore pg_dump (custom format — pipe via stdin)
      await execAsync(
        `cat "${restoreDir}/${extractedDir}/database.dump" | docker exec -i -e ${pgEnv} ${container} pg_restore -U ${user} -d ${db}`,
        { timeout: 180_000, maxBuffer: 50 * 1024 * 1024 }
      );

      // Restore uploads
      await execAsync(
        `cp -r "${restoreDir}/${extractedDir}/uploads/." "${APP_DIR}/backend/uploads/" 2>/dev/null || true`
      );

      this.logger.log("Restore complete.");
    } finally {
      await execAsync(`rm -rf "${restoreDir}"`).catch(() => {});
    }
  }

  async deleteBackup(filename: string): Promise<void> {
    if (!FILENAME_RE.test(filename)) {
      throw new BadRequestException("Tên file không hợp lệ.");
    }
    await execAsync(`rclone deletefile "${RCLONE_REMOTE}/${filename}"`);
  }
}
