import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios'; // Import HttpModule
import { EspnDataService } from './services/espn-data.service';
import { ConfigService } from '@nestjs/config'; // Assuming you're using ConfigService
import { Team } from '../teams/teams.model'; // Adjust as needed

@Module({
  imports: [HttpModule], // Add HttpModule here
  providers: [EspnDataService, ConfigService, Team,],
  exports: [EspnDataService],
})
export class DataSourceModule {}