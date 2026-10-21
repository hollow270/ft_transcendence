import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Verdict } from '@prisma/client';
import { once } from 'events';
import { Socket } from 'net';
import {
  ScannerCompletedResult,
  ScannerEngineResult,
  StartFileScanInput,
} from './scanning.types';

@Injectable()
export class ClamAvProvider {
  readonly name = 'clamav';
  readonly supportsPrivate = true;

  private readonly logger = new Logger(ClamAvProvider.name);

  get configured() {
    return Boolean(
      (process.env.CLAMAV_HOST ?? 'clamav').trim(),
    );
  }

  async isAvailable() {
    if (!this.configured) return false;

    try {
      const reply = await this.simpleCommand(
        'zPING\0',
        Number(process.env.CLAMAV_HEALTH_TIMEOUT_MS ?? 2000),
      );
      return reply.trim().toUpperCase() === 'PONG';
    } catch {
      return false;
    }
  }

  async scanFile(
    input: StartFileScanInput,
  ): Promise<ScannerCompletedResult> {
    const startedAt = Date.now();
    const reply = await this.scanBuffer(input.file.buffer);

    const result = this.parseReply(
      reply,
      Date.now() - startedAt,
    );

    return {
      state: 'COMPLETED',
      provider: this.name,
      completedAt: new Date(),
      results: [result],
    };
  }

  async rescanFile(): Promise<never> {
    throw new BadRequestException(
      'ClamAV rescanning requires the original file because GO VIRUS does not retain uploaded binaries after scanning. Re-upload the file to run ClamAV again.',
    );
  }

  private async simpleCommand(
    command: string,
    timeoutMs: number,
  ): Promise<string> {
    const host =
      (process.env.CLAMAV_HOST ?? 'clamav').trim();
    const port = Number(
      process.env.CLAMAV_PORT ?? 3310,
    );

    const socket = new Socket();
    let reply = '';

    return new Promise<string>((resolve, reject) => {
      let settled = false;

      const finish = (
        error?: Error,
        value?: string,
      ) => {
        if (settled) return;
        settled = true;
        socket.destroy();

        if (error) {
          reject(error);
        } else {
          resolve(value ?? '');
        }
      };

      socket.setTimeout(timeoutMs);

      socket.on('timeout', () =>
        finish(new Error('timeout')),
      );
      socket.on('error', (error) =>
        finish(error),
      );
      socket.on('data', (data) => {
        reply += data.toString('utf8');

        if (reply.includes('\0')) {
          finish(
            undefined,
            reply.replace(/\0/g, '').trim(),
          );
        }
      });
      socket.on('end', () =>
        finish(
          undefined,
          reply.replace(/\0/g, '').trim(),
        ),
      );

      socket.connect(port, host, () => {
        socket.write(Buffer.from(command));
      });
    });
  }

  private async scanBuffer(buffer: Buffer): Promise<string> {
    const host =
      (process.env.CLAMAV_HOST ?? 'clamav').trim();
    const port = Number(
      process.env.CLAMAV_PORT ?? 3310,
    );
    const timeoutMs = Number(
      process.env.CLAMAV_TIMEOUT_MS ?? 30000,
    );
    const chunkSize = 64 * 1024;

    const socket = new Socket();
    let reply = '';
    let settled = false;

    return new Promise<string>((resolve, reject) => {
      const finishReject = (error: Error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(error);
      };

      socket.setTimeout(timeoutMs);

      socket.on('timeout', () => {
        finishReject(
          new BadGatewayException(
            'ClamAV scan timed out.',
          ),
        );
      });

      socket.on('error', (error) => {
        this.logger.error(
          'ClamAV connection failed: ' +
            error.message,
        );
        finishReject(
          new BadGatewayException(
            'ClamAV is unavailable.',
          ),
        );
      });

      socket.on('data', (data) => {
        reply += data.toString('utf8');

        if (reply.includes('\0')) {
          if (settled) return;
          settled = true;
          socket.end();
          resolve(reply.replace(/\0/g, '').trim());
        }
      });

      socket.on('end', () => {
        if (settled) return;
        settled = true;

        if (!reply.trim()) {
          reject(
            new BadGatewayException(
              'ClamAV returned an empty response.',
            ),
          );
          return;
        }

        resolve(reply.replace(/\0/g, '').trim());
      });

      socket.connect(port, host, async () => {
        try {
          socket.write(Buffer.from('zINSTREAM\0'));

          for (
            let offset = 0;
            offset < buffer.length;
            offset += chunkSize
          ) {
            const chunk = buffer.subarray(
              offset,
              Math.min(offset + chunkSize, buffer.length),
            );
            const length = Buffer.allocUnsafe(4);
            length.writeUInt32BE(chunk.length, 0);

            if (!socket.write(length)) {
              await once(socket, 'drain');
            }

            if (!socket.write(chunk)) {
              await once(socket, 'drain');
            }
          }

          const end = Buffer.alloc(4);
          end.writeUInt32BE(0, 0);
          socket.write(end);
        } catch (error: any) {
          finishReject(
            new BadGatewayException(
              'ClamAV stream failed: ' +
                (error?.message ?? 'unknown error'),
            ),
          );
        }
      });
    });
  }

  private parseReply(
    reply: string,
    responseTimeMs: number,
  ): ScannerEngineResult {
    const normalized = reply.trim();

    if (/\sFOUND$/i.test(normalized)) {
      const match = normalized.match(
        /:\s*(.+?)\s+FOUND$/i,
      );

      return {
        engineName: 'ClamAV (local)',
        verdict: Verdict.MALICIOUS,
        detectionName:
          match?.[1]?.trim() ?? 'Malware detected',
        responseTimeMs,
        rawResult: {
          reply: normalized,
          local: true,
        },
      };
    }

    if (/\sOK$/i.test(normalized)) {
      return {
        engineName: 'ClamAV (local)',
        verdict: Verdict.HARMLESS,
        detectionName: null,
        responseTimeMs,
        rawResult: {
          reply: normalized,
          local: true,
        },
      };
    }

    if (/\sERROR$/i.test(normalized)) {
      throw new BadGatewayException(
        'ClamAV scan error: ' + normalized,
      );
    }

    return {
      engineName: 'ClamAV (local)',
      verdict: Verdict.UNKNOWN,
      detectionName: null,
      responseTimeMs,
      rawResult: {
        reply: normalized,
        local: true,
      },
    };
  }
}
