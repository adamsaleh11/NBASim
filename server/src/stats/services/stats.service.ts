// src/stats/services/stats.service.ts

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

  // Fetch current standings
  async getCurrentStandings(): Promise<TeamStatsDTO[]> {
    const today = new Date();
    const season = this.getCurrentSeason();

    const standings = await this.teamStatsModel
      .find({ date: { $lte: today }, season })
      .sort({ wins: -1 })
      .lean()
      .exec();

    return standings.map(stat => this.mapToTeamStatsDTO(stat));
  }

  // Fetch standings for a specific year
  async getStandingsForYear(year: string): Promise<TeamStatsDTO[]> {
    const standings = await this.espnDataService.fetchStandingsForYear(year);
    return standings.map(stat => this.mapToTeamStatsDTO(stat));
  }

  // Fetch team stats by filters (season, conference, date, teamName)
  async getTeamStats(filters: {
    season?: string;
    conference?: string;
    date?: Date;
    teamName?: string;
  }): Promise<TeamStatsDTO[]> {
    const query: any = {};

    if (filters.season) query.season = filters.season;
    if (filters.conference) query.conference = filters.conference;
    if (filters.date) query.date = { $lte: filters.date };
    if (filters.teamName) query.teamName = filters.teamName;

    const stats = await this.teamStatsModel.find(query).sort({ date: -1 }).lean().exec();
    return stats.map(stat => this.mapToTeamStatsDTO(stat));
  }

  // Fetch team stats by date
  async getTeamStatsByDate(teamName: string, date: Date): Promise<TeamStatsDTO> {
    const stat = await this.teamStatsModel
      .findOne({ teamName, date: { $lte: date } })
      .sort({ date: -1 })
      .lean()
      .exec();

    if (!stat) {
      throw new NotFoundException(`No stats found for team ${teamName} on or before ${date}`);
    }

    return this.mapToTeamStatsDTO(stat);
  }

  // Fetch team stats history within a date range
  async getTeamStatsHistory(
    teamName: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TeamStatsDTO[]> {
    const stats = await this.teamStatsModel
      .find({
        teamName,
        date: { $gte: startDate, $lte: endDate },
      })
      .sort({ date: 1 })
      .lean()
      .exec();

    return stats.map(stat => this.mapToTeamStatsDTO(stat));
  }

  // Helper method to get the current season
  private getCurrentSeason(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    // NBA seasons typically run from October to June
    if (month < 9) {
      // Before October, it's the previous season
      return `${year - 1}-${year}`;
    } else {
      return `${year}-${year + 1}`;
    }
  }

  // Map a MongoDB document to a TeamStatsDTO
  private mapToTeamStatsDTO(stat: TeamStatsDocument | any): TeamStatsDTO {
    return {
      id: stat._id.toString(),
      teamId: stat.teamId?.toString(),
      teamName: stat.teamName,
      conference: stat.conference,
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