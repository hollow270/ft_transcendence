import { BadRequestException, Injectable } from '@nestjs/common';
import { basename } from 'path';
import { ScannerFile } from '../scanning/scanning.types';

@Injectable()
export class FileValidationService {
  private readonly maxBytes =
    Number(process.env.MAX_FILE_SIZE_MB ?? 25) *
    1024 *
    1024;

  validate(file: ScannerFile | undefined): ScannerFile {
    if (!file?.buffer) {
      throw new BadRequestException('file is required');
    }

    if (file.size <= 0 || file.buffer.byteLength <= 0) {
      throw new BadRequestException('empty files are not accepted');
    }

    if (
      file.size > this.maxBytes ||
      file.buffer.byteLength > this.maxBytes
    ) {
      throw new BadRequestException(
        'file exceeds the configured upload size limit',
      );
    }

    const cleanName = basename(file.originalname || '').trim();

    if (!cleanName) {
      throw new BadRequestException('file name is required');
    }

    if (cleanName.length > 255) {
      throw new BadRequestException(
        'file name must not exceed 255 characters',
      );
    }

    if (/[\u0000-\u001F\u007F]/.test(cleanName)) {
      throw new BadRequestException(
        'file name contains invalid control characters',
      );
    }

    return {
      ...file,
      originalname: cleanName,
      mimetype:
        (file.mimetype || 'application/octet-stream')
          .slice(0, 255),
    };
  }
}
