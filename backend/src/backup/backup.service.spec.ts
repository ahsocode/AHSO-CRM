import { ConfigService } from "@nestjs/config";
import type { BackupService } from "./backup.service";

type ExecCallback = (error: Error | null, stdout: unknown, stderr: string) => void;
type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;

const execMock = jest.fn();
const execFileMock = jest.fn();
const spawnMock = jest.fn();
const writeFileMock = jest.fn();
const chmodMock = jest.fn();
const rmMock = jest.fn();

jest.mock("child_process", () => ({
  exec: (...args: unknown[]) => execMock(...args),
  execFile: (...args: unknown[]) => execFileMock(...args),
  spawn: (...args: unknown[]) => spawnMock(...args)
}));

jest.mock("fs/promises", () => ({
  writeFile: (...args: unknown[]) => writeFileMock(...args),
  chmod: (...args: unknown[]) => chmodMock(...args),
  rm: (...args: unknown[]) => rmMock(...args)
}));

describe("BackupService", () => {
  beforeEach(() => {
    execMock.mockReset();
    execFileMock.mockReset();
    spawnMock.mockReset();
    writeFileMock.mockReset();
    chmodMock.mockReset();
    rmMock.mockReset();
    writeFileMock.mockResolvedValue(undefined);
    chmodMock.mockResolvedValue(undefined);
    rmMock.mockResolvedValue(undefined);
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

  it("restoreBackup uses local psql and pg_restore clients without docker", async () => {
    const { EventEmitter } = await import("events");
    execMock.mockImplementation((_command: string, ...args: unknown[]) => {
      const callback = args.find((arg): arg is ExecCallback => typeof arg === "function");
      callback?.(null, "", "");
    });
    execFileMock.mockImplementation((_command: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
      callback(null, "", "");
    });
    spawnMock.mockImplementation((command: string, args: string[]) => {
      const child = new EventEmitter();
      process.nextTick(() => child.emit("close", 0));
      expect(command).toBe("pg_restore");
      expect(args).toEqual(expect.arrayContaining(["-h", "postgres", "-U", "ahso", "-d", "ahso_crm"]));
      return child;
    });

    await expect(createService().restoreBackup("ahso-crm-2026-05-19_08-30.tar.gz")).resolves.toBeUndefined();

    expect(writeFileMock).toHaveBeenCalledWith(
      "/tmp/ahso-crm.pgpass",
      "*:*:*:ahso:\n",
      { mode: 0o600 }
    );
    expect(chmodMock).toHaveBeenCalledWith("/tmp/ahso-crm.pgpass", 0o600);
    expect(execFileMock.mock.calls[0]?.slice(0, 3)).toEqual([
      "psql",
      ["-h", "postgres", "-U", "ahso", "-d", "postgres", "-c", 'DROP DATABASE IF EXISTS "ahso_crm";'],
      expect.objectContaining({ env: expect.objectContaining({ PGPASSFILE: "/tmp/ahso-crm.pgpass" }) })
    ]);
    expect(execFileMock).not.toHaveBeenCalledWith("docker", expect.anything());
    expect(spawnMock).not.toHaveBeenCalledWith("docker", expect.anything());
    expect(rmMock).toHaveBeenCalledWith("/tmp/ahso-crm.pgpass", { force: true });
  });
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
