import { ConfigService } from "@nestjs/config";
import type { BackupService } from "./backup.service";

type ExecCallback = (error: Error | null, stdout: unknown, stderr: string) => void;

const execMock = jest.fn();
const execFileMock = jest.fn();
const spawnMock = jest.fn();

jest.mock("child_process", () => ({
  exec: (...args: unknown[]) => execMock(...args),
  execFile: (...args: unknown[]) => execFileMock(...args),
  spawn: (...args: unknown[]) => spawnMock(...args)
}));

describe("BackupService", () => {
  beforeEach(() => {
    execMock.mockReset();
    execFileMock.mockReset();
    spawnMock.mockReset();
  });

  it("listBackups returns valid backup files sorted newest first", async () => {
    execMock.mockImplementation((command: string, ...args: unknown[]) => {
      const callback = args.find((arg): arg is ExecCallback => typeof arg === "function");
      expect(command).toBe('rclone lsjson "Remote:Backups/"');
      callback?.(null, {
        stdout: JSON.stringify([
          {
            Name: "ignore.txt",
            Size: 10,
            ModTime: "2026-05-01T00:00:00.000Z"
          },
          {
            Name: "ahso-crm-2026-05-18_08-30.tar.gz",
            Size: 1_048_576,
            ModTime: "2026-05-18T08:30:00.000Z"
          },
          {
            Name: "ahso-crm-2026-05-19_08-30.tar.gz",
            Size: 2048,
            ModTime: "2026-05-19T08:30:00.000Z"
          }
        ]),
        stderr: ""
      }, "");
    });

    const result = await createService().listBackups();
    expect(result).toEqual([
      {
        name: "ahso-crm-2026-05-19_08-30.tar.gz",
        size: 2048,
        modTime: "2026-05-19T08:30:00.000Z",
        sizeHuman: "2 KB"
      },
      {
        name: "ahso-crm-2026-05-18_08-30.tar.gz",
        size: 1_048_576,
        modTime: "2026-05-18T08:30:00.000Z",
        sizeHuman: "1.0 MB"
      }
    ]);
  });

  it("listBackups returns an empty list when the backup remote is unavailable", async () => {
    execMock.mockImplementation((_command: string, ...args: unknown[]) => {
      const callback = args.find((arg): arg is ExecCallback => typeof arg === "function");
      callback?.(new Error("directory not found"), "", "missing");
    });

    await expect(createService().listBackups()).resolves.toEqual([]);
  });

  it("createBackup runs the production backup script with timeout and buffer limits", async () => {
    execMock.mockImplementation((
      command: string,
      options: { timeout: number; maxBuffer: number },
      callback: ExecCallback
    ) => {
      expect(command).toBe("/opt/backup-ahso-crm.sh");
      expect(options).toEqual({
        timeout: 300_000,
        maxBuffer: 10 * 1024 * 1024
      });
      callback(null, "", "");
    });

    await expect(createService().createBackup()).resolves.toBeUndefined();
  });

  it.todo("restoreBackup streams pg_restore through docker and writes a temporary .pgpass file");
});

function createService() {
  const { BackupService: BackupServiceClass } = jest.requireActual<typeof import("./backup.service")>("./backup.service");
  const configService = {
    get: jest.fn((key: string) => {
      if (key === "RCLONE_REMOTE") return "Remote:Backups";
      return undefined;
    })
  } as Partial<ConfigService> as ConfigService;

  return new BackupServiceClass(configService) as BackupService;
}
