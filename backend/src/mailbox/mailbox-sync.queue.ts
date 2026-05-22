import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { MailboxSyncService } from "./mailbox-sync.service";

export interface SyncJobData {
  accountId: string;
}

function parseRedisUrl(url: string): ConnectionOptions {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined,
      db: Number(parsed.pathname?.replace("/", "")) || 0,
    };
  } catch {
    return { host: "127.0.0.1", port: 6379 };
  }
}

@Injectable()
export class MailboxSyncQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailboxSyncQueue.name);
  private queue!: Queue<SyncJobData>;
  private worker!: Worker<SyncJobData>;

  constructor(
    private readonly config: ConfigService,
    private readonly syncService: MailboxSyncService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>("REDIS_URL", "redis://127.0.0.1:6379");
    const connection = parseRedisUrl(redisUrl);

    this.queue = new Queue<SyncJobData>("mailbox-sync", {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 }, // 5s → 15s → 45s → 2m → 5m
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    });

    this.worker = new Worker<SyncJobData>(
      "mailbox-sync",
      async (job: Job<SyncJobData>) => {
        this.logger.log(`Syncing account ${job.data.accountId} (attempt ${job.attemptsMade + 1})`);
        await this.syncService.syncAccount(job.data.accountId);
      },
      { connection, concurrency: 3 },
    );

    this.worker.on("failed", (job, err) => {
      this.logger.warn(`Sync job ${job?.data.accountId} failed: ${err.message}`);
    });
  }

  async enqueueSync(accountId: string): Promise<void> {
    // jobId dedup: prevents concurrent sync jobs for the same account
    await this.queue.add("sync", { accountId }, { jobId: `sync-${accountId}` });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
