// src/stats/stats.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeamStats, TeamStatsSchema } from './schemas/team-stats.schema';
import { StatsService } from './services/stats.service';
import { TeamStatsResolver } from './resolvers/team-stats.resolver';
import { DataSourceModule } from '../data-source/data-source.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TeamStats.name, schema: TeamStatsSchema }]),
    DataSourceModule,
  ],
  providers: [StatsService, TeamStatsResolver],
  exports: [StatsService],
})
export class StatsModule {}