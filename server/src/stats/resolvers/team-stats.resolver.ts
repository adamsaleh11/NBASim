// src/stats/resolvers/team-stats.resolver.ts

import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { StatsService } from '../services/stats.service';
import { TeamStatsDTO } from '../dtos/team-stats.dto';

@Resolver(() => TeamStatsDTO)
export class StatsResolver {
  constructor(private readonly statsService: StatsService) {}

  @Query(() => [TeamStatsDTO])
  async teamStats(
    @Args('season', { nullable: true }) season?: string,
    @Args('conference', { nullable: true }) conference?: string,
    @Args('date', { nullable: true }) date?: Date,
    @Args('teamName', { nullable: true }) teamName?: string,
  ): Promise<TeamStatsDTO[]> {
    return this.statsService.getTeamStats({ season, conference, date, teamName });
  }

  @Query(() => TeamStatsDTO)
  async teamStatsByDate(
    @Args('teamName') teamName: string,
    @Args('date') date: Date,
  ): Promise<TeamStatsDTO> {
    return this.statsService.getTeamStatsByDate(teamName, date);
  }

  @Query(() => [TeamStatsDTO])
  async teamStatsHistory(
    @Args('teamName') teamName: string,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
  ): Promise<TeamStatsDTO[]> {
    return this.statsService.getTeamStatsHistory(teamName, startDate, endDate);
  }
}