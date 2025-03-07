import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { NotFoundException } from '@nestjs/common';
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
    @Args('limit', { nullable: true, defaultValue: 10 }) limit?: number,
    @Args('sortBy', { nullable: true, defaultValue: 'date' }) sortBy?: string,
  ): Promise<TeamStatsDTO[]> {
    try {
      return await this.statsService.getTeamStats({ season, conference, date, teamName, limit, sortBy });
    } catch (error) {
      throw new NotFoundException(`Failed to fetch team stats: ${error.message}`);
    }
  }

  @Query(() => TeamStatsDTO)
  async teamStatsByDate(
    @Args('teamName') teamName: string,
    @Args('date') date: Date,
  ): Promise<TeamStatsDTO> {
    try {
      return await this.statsService.getTeamStatsByDate(teamName, date);
    } catch (error) {
      throw new NotFoundException(`No stats found for team ${teamName} on or before ${date}: ${error.message}`);
    }
  }

  @Query(() => [TeamStatsDTO])
  async teamStatsHistory(
    @Args('teamName') teamName: string,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
  ): Promise<TeamStatsDTO[]> {
    try {
      return await this.statsService.getTeamStatsHistory(teamName, startDate, endDate);
    } catch (error) {
      throw new NotFoundException(`Failed to fetch history for team ${teamName}: ${error.message}`);
    }
  }

  @Query(() => [TeamStatsDTO])
  async currentStandings(): Promise<TeamStatsDTO[]> {
    try {
      return await this.statsService.getCurrentStandings();
    } catch (error) {
      throw new NotFoundException(`Failed to fetch current standings: ${error.message}`);
    }
  }
}