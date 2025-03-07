import { Module } from '@nestjs/common';
import { EspnDataService } from './services/espn-data.service';

@Module({
  providers: [EspnDataService],
  exports: [EspnDataService], // Exporting to be used by other modules
})
export class DataSourceModule {}