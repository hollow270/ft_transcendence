import { Module } from '@nestjs/common';
import { ClamAvProvider } from './clamav.provider';
import { DevelopmentScanProvider } from './development-scan.provider';
import { ScanningService } from './scanning.service';
import { VirusTotalProvider } from './virustotal.provider';

@Module({
  providers: [
    ScanningService,
    DevelopmentScanProvider,
    ClamAvProvider,
    VirusTotalProvider,
  ],
  exports: [ScanningService],
})
export class ScanningModule {}
