import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EspnDataService } from './services/espn-data.service';

@Module({
  imports: [HttpModule],
  providers: [EspnDataService],
  exports: [EspnDataService],
})
export class DataSourceModule {}