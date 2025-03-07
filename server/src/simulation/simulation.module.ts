import { Module } from '@nestjs/common';
import { SimulationService } from './services/simulation.service';
import { StatsService } from '../stats/services/stats.service';

@Module({
  imports: [],
  providers: [SimulationService, StatsService],  // Add SimulationModel here
})
export class SimulationModule {}