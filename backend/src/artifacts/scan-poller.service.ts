import { Injectable, Logger, OnModuleDestroy, OnModuleInit, } from '@nestjs/common';
import { ArtifactsService } from './artifacts.service';

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_BATCH_SIZE = 3;
const DEFAULT_MAX_RUNNING_MS = 60 * 60 * 1000;

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

@Injectable()
export class ScanPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanPollerService.name);
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(private readonly artifacts: ArtifactsService) {}

  onModuleInit() {
    const intervalMs = Number(
      process.env.SCAN_BACKGROUND_POLL_MS ?? DEFAULT_INTERVAL_MS,
    );

    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      this.logger.log('background scan polling is disabled');
      return;
    }

    this.timer = setInterval(() => void this.tick(), intervalMs);
    this.timer.unref();
    this.logger.log(`background scan polling every ${intervalMs} ms`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async tick() {
    if (this.busy) {
      return;
    }

    this.busy = true;

    try {
      const summary = await this.artifacts.pollRunningScans({
        batchSize: Math.floor(
          positiveNumber(
            process.env.SCAN_BACKGROUND_POLL_BATCH,
            DEFAULT_BATCH_SIZE,
          ),
        ),
        maxRunningMs: positiveNumber(
          process.env.SCAN_MAX_RUNNING_MS,
          DEFAULT_MAX_RUNNING_MS,
        ),
      });

      if (summary.polled || summary.failed || summary.expired) {
        this.logger.log(
          `polled ${summary.polled}, completed ${summary.completed}, ` +
            `errors ${summary.failed}, expired ${summary.expired}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `background scan polling failed: ${
          error instanceof Error ? error.message : error
        }`,
      );
    } finally {
      this.busy = false;
    }
  }
}
