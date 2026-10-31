import { Module } from '@nestjs/common';
import { DevelopmentScanProvider } from './development-scan.provider';
import { ScanningService } from './scanning.service';
import { VirusTotalProvider } from './virustotal.provider';

@Module({
  providers: [
    ScanningService,
    DevelopmentScanProvider,
    VirusTotalProvider,
  ],
  exports: [ScanningService],
})
export class ScanningModule {}
