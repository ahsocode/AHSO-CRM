import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createReadStream } from "fs";
import { exec, execFile, spawn } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const execAsync = promisify(exec);

const PGPASS_FILE = "/tmp/ahso-crm.pgpass";

function writeContainerStdin(args: string[], input: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args);
    child.stdin.end(input);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`docker exited ${code}`))));
    child.on("error", reject);
  });
}

function spawnRestore(dumpPath: string, pg: { container: string; user: string; db: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [
      "exec", "-i",
      pg.container,
      "sh", "-c", `PGPASSFILE=${PGPASS_FILE} pg_restore -U "$1" -d "$2"`,
      "sh", pg.user, pg.db
    ]);

    createReadStream(dumpPath).pipe(child.stdin);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`pg_restore exited ${code}`))));
    child.on("error", reject);
  });
}

export interface BackupFile {
  name: string;
  size: number;
  modTime: string;
  sizeHuman: string;
}

const FILENAME_RE = /^ahso-crm-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.tar\.gz$/;
// Override via RCLONE_REMOTE env var in .env.production.local if your rclone
// remote is named differently (e.g. "gdrive:AHSO-CRM-Backups").
const DEFAULT_RCLONE_REMOTE = "AHSO-CRM-Backup:AHSO-CRM-Backups";
const BACKUP_SCRIPT = "/opt/backup-ahso-crm.sh";
const APP_DIR = "/opt/AHSO-CRM";
const SAFE_IDENTIFIER_RE = /^[A-Za-z0-9_]+$/;

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

  private get rcloneRemote(): string {
    return this.config.get<string>("RCLONE_REMOTE") ?? DEFAULT_RCLONE_REMOTE;
  }

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
      const { stdout } = await execAsync(`rclone lsjson "${this.rcloneRemote}/"`);
      const files: Array<{ Name: string; Size: number; ModTime: string }> = JSON.parse(stdout || "[]");
      return files
        .filter((f) => FILENAME_RE.test(f.Name))
        .sort((a, b) => b.ModTime.localeCompare(a.ModTime))
        .map((f) => ({ name: f.Name, size: f.Size, modTime: f.ModTime, sizeHuman: humanSize(f.Size) }));
    } catch (err) {
      this.logger.error(`listBackups failed (remote: ${this.rcloneRemote}): ${String(err)}`);
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

    try {
      this.logger.log(`Restoring from ${filename}...`);

      await execAsync(`mkdir -p "${restoreDir}"`);

      // Download from Google Drive
      await execAsync(`rclone copy "${this.rcloneRemote}/${filename}" "${restoreDir}/"`, {
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024
      });

      // Extract
      await execAsync(`cd "${restoreDir}" && tar -xzf "${filename}"`);
      await this.createPgpass(container, user, db, password);

      // Drop and recreate database — use execFile (no shell) to avoid injection
      this.assertSafePgIdentifier(db);
      await execFileAsync("docker", [
        "exec", container,
        "sh", "-c", `PGPASSFILE=${PGPASS_FILE} psql -U "$1" -d postgres -c 'DROP DATABASE IF EXISTS "${db}";'`,
        "sh", user
      ]);
      await execFileAsync("docker", [
        "exec", container,
        "sh", "-c", `PGPASSFILE=${PGPASS_FILE} psql -U "$1" -d postgres -c 'CREATE DATABASE "${db}";'`,
        "sh", user
      ]);

      // Restore pg_dump — spawn with stdin pipe, no shell interpolation
      await spawnRestore(`${restoreDir}/${extractedDir}/database.dump`, { container, user, db });

      // Restore uploads
      await execAsync(
        `cp -r "${restoreDir}/${extractedDir}/uploads/." "${APP_DIR}/backend/uploads/" 2>/dev/null || true`
      );

      this.logger.log("Restore complete.");
    } finally {
      await this.removePgpass(this.pg.container).catch(() => {});
      await execAsync(`rm -rf "${restoreDir}"`).catch(() => {});
    }
  }

  async deleteBackup(filename: string): Promise<void> {
    if (!FILENAME_RE.test(filename)) {
      throw new BadRequestException("Tên file không hợp lệ.");
    }
    await execAsync(`rclone deletefile "${this.rcloneRemote}/${filename}"`);
  }

  private async createPgpass(container: string, user: string, db: string, password: string) {
    const escapedPassword = password.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
    const pgpass = `*:*:*:${user}:${escapedPassword}\n`;
    await writeContainerStdin([
      "exec", "-i", container,
      "sh", "-c", `umask 077 && cat > ${PGPASS_FILE}`
    ], pgpass);
  }

  private async removePgpass(container: string) {
    await execFileAsync("docker", ["exec", container, "rm", "-f", PGPASS_FILE]);
  }

  private assertSafePgIdentifier(identifier: string) {
    if (!SAFE_IDENTIFIER_RE.test(identifier)) {
      throw new BadRequestException("Tên database không hợp lệ.");
    }
  }
}
