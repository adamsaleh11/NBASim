import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TeamStats, TeamStatsDocument } from '../schemas/team-stats.schema';
import { TeamStatsDTO } from '../dtos/team-stats.dto';
import { EspnDataService } from '../../data-source/services/espn-data.service';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(
    @InjectModel(TeamStats.name) private teamStatsModel: Model<TeamStatsDocument>,
    private readonly espnDataService: EspnDataService,
  ) {}

  async getCurrentStandings(): Promise<TeamStatsDTO[]> {
    const today = new Date('2025-03-07T08:30:00-08:00'); // Specific to March 7, 2025, 08:30 AM PST
    const season = this.getCurrentSeason();

    const standings = await this.teamStatsModel
      .find({ date: { $lte: today }, season })
      .populate('teamId', 'name conference')
      .sort({ wins: -1, losses: 1 })
      .lean()
      .exec();

    if (!standings.length) {
      throw new NotFoundException(`No standings found for season ${season} up to ${today}`);
    }

    return standings.map(stat => this.mapToTeamStatsDTO(stat));
  }

  async getStandingsForYear(year: string): Promise<TeamStatsDTO[]> {
    const standings = await this.espnDataService.fetchStandingsForYear(year);
    return standings.map(stat => this.mapToTeamStatsDTO(stat));
  }

  async getTeamStats(filters: {
    season?: string;
    conference?: string;
    date?: Date;
    teamName?: string;
    limit?: number;
    sortBy?: string;
  }): Promise<TeamStatsDTO[]> {
    const query: any = {};
    if (filters.season) query.season = filters.season;
    if (filters.conference) query.conference = filters.conference;
    if (filters.date) query.date = { $lte: filters.date };
    if (filters.teamName) query.teamName = filters.teamName;

    const stats = await this.teamStatsModel
      .find(query)
      .populate('teamId', 'name conference')
      .sort({ [filters.sortBy || 'date']: -1 })
      .limit(filters.limit || 10)
      .lean()
      .exec();

    return stats.map(stat => this.mapToTeamStatsDTO(stat));
  }

  async getTeamStatsByDate(teamName: string, date: Date): Promise<TeamStatsDTO> {
    const team = await this.espnDataService.findTeamByName(teamName);
    if (!team) throw new NotFoundException(`Team ${teamName} not found`);

    const stat = await this.teamStatsModel
      .findOne({ teamId: team._id, date: { $lte: date } })
      .populate('teamId', 'name conference')
      .sort({ date: -1 })
      .lean()
      .exec();

    if (!stat) {
      throw new NotFoundException(`No stats found for team ${teamName} on or before ${date}`);
    }

    return this.mapToTeamStatsDTO(stat);
  }

  async getTeamStatsHistory(
    teamName: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TeamStatsDTO[]> {
    const team = await this.espnDataService.findTeamByName(teamName);
    if (!team) throw new NotFoundException(`Team ${teamName} not found`);

    const stats = await this.teamStatsModel
      .find({ teamId: team._id, date: { $gte: startDate, $lte: endDate } })
      .populate('teamId', 'name conference')
      .sort({ date: 1 })
      .lean()
      .exec();

    return stats.map(stat => this.mapToTeamStatsDTO(stat));
  }

  async getPostAllStarBreakStats(teamName: string, season: string): Promise<TeamStatsDTO[]> {
    const allStarDate = new Date(`${season.split('-')[0]}-02-20`); // Approximate All-Star break (mid-February)
    const team = await this.espnDataService.findTeamByName(teamName);
    if (!team) throw new NotFoundException(`Team ${teamName} not found`);

    const stats = await this.teamStatsModel
      .find({ teamId: team._id, season, date: { $gte: allStarDate } })
      .populate('teamId', 'name conference')
      .sort({ date: 1 })
      .lean()
      .exec();

    return stats.map(stat => this.mapToTeamStatsDTO(stat));
  }

  public getCurrentSeason(): string {
    const today = new Date('2025-03-07T08:30:00-08:00'); // Specific to March 7, 2025, 08:30 AM PST
    const year = today.getFullYear();
    const month = today.getMonth();

    return month < 9 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
  }

  private mapToTeamStatsDTO(stat: TeamStatsDocument | any): TeamStatsDTO {
    return {
      id: stat._id.toString(),
      teamId: stat.teamId?._id?.toString() || stat.teamId,
      teamName: stat.teamId?.name || 'Unknown',
      conference: stat.teamId?.conference || 'Unknown',
      season: stat.season,
      date: stat.date,
      offensiveRating: stat.offensiveRating,
      defensiveRating: stat.defensiveRating,
      threePointPercentage: stat.threePointPercentage,
      fieldGoalPercentage: stat.fieldGoalPercentage,
      reboundsPerGame: stat.reboundsPerGame,
      assistsPerGame: stat.assistsPerGame,
      turnoversPerGame: stat.turnoversPerGame,
      stealsPerGame: stat.stealsPerGame,
      blocksPerGame: stat.blocksPerGame,
      pointsPerGame: stat.pointsPerGame,
      gamesPlayed: stat.gamesPlayed,
      wins: stat.wins,
      losses: stat.losses,
      additionalStats: stat.additionalStats,
      dataSource: stat.dataSource,
    };
  }
}