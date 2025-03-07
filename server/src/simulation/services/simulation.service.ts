// src/simulation/services/simulation.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Simulation, SimulationDocument } from '../schemas/simulation.schema';
import { SimulationInput, WeightingInput } from '../dtos/simulation-input.dto';
import { SimulationResult, ConferenceResult, RoundResult, SeriesResult, TeamSimulationResult } from '../dtos/simulation-result.dto';
import { StatsService } from '../../stats/services/stats.service';

@Injectable()
export class SimulationService {
  private readonly logger = new Logger(SimulationService.name);

  constructor(
    @InjectModel(Simulation.name) private simulationModel: Model<SimulationDocument>,
    private readonly statsService: StatsService,
  ) {}

  // Get all simulations (optionally filtered by season)
  async getSimulations(season?: string, limit = 10): Promise<SimulationResult[]> {
    const query = season ? { season } : {};
    const simulations = await this.simulationModel.find(query).sort({ date: -1 }).limit(limit).lean().exec();
    return simulations.map(sim => this.mapToSimulationResult(sim));
  }

  // Get a simulation by ID
  async getSimulationById(id: string): Promise<SimulationResult> {
    const simulation = await this.simulationModel.findById(id).lean().exec();
    if (!simulation) {
      throw new NotFoundException(`Simulation with ID ${id} not found`);
    }
    return this.mapToSimulationResult(simulation);
  }

  // Get the latest simulation
  async getLatestSimulation(): Promise<SimulationResult> {
    const simulation = await this.simulationModel.findOne().sort({ date: -1 }).lean().exec();
    if (!simulation) {
      throw new NotFoundException('No simulations found');
    }
    return this.mapToSimulationResult(simulation);
  }

  // Run a new simulation
  async runSimulation(input: SimulationInput): Promise<SimulationResult> {
    this.logger.log(`Running simulation for season ${input.season}`);

    const date = input.date || new Date();
    const weighting = input.weighting || {
      offensiveWeight: 0.30,
      defensiveWeight: 0.50,
      threePointWeight: 0.20,
    };

    // Fetch the latest stats for each team
    const teamStats = await this.statsService.getTeamStats({
      season: input.season,
      date,
    });

    if (teamStats.length < 16) {
      throw new Error(`Not enough teams (found ${teamStats.length}, need at least 16) to run a playoff simulation`);
    }

    // Calculate weighted ratings for each team
    const teamsWithRatings = this.calculateTeamRatings(teamStats, weighting);

    // Split teams into conferences
    const conferences = this.splitTeamsByConference(teamsWithRatings);

    // Simulate play-in tournament for both conferences
    const easternPlayoffTeams = this.simulatePlayInTournament(conferences['Eastern']);
    const westernPlayoffTeams = this.simulatePlayInTournament(conferences['Western']);

    // Simulate playoffs for each conference
    const easternResult = this.simulateConferencePlayoffs('Eastern', easternPlayoffTeams, input.useLuckFactor ?? false, input.useHomeCourtAdvantage ?? true);
    const westernResult = this.simulateConferencePlayoffs('Western', westernPlayoffTeams, input.useLuckFactor ?? false, input.useHomeCourtAdvantage ?? true);

    // Simulate NBA Finals
    const nbaChampion = this.simulateFinals(
      easternResult.champion,
      westernResult.champion,
      input.useLuckFactor ?? false,
      input.useHomeCourtAdvantage ?? true
    );

    // Save the simulation result to the database
    const simulation = new this.simulationModel({
      season: input.season,
      date,
      conferences: [easternResult, westernResult],
      champion: nbaChampion,
      weighting,
    });

    const savedSimulation = await simulation.save();
    return this.mapToSimulationResult(savedSimulation.toObject());
  }

  // Map a MongoDB document to a SimulationResult DTO
  private mapToSimulationResult(simulation: SimulationDocument | any): SimulationResult {
    return {
      id: simulation._id.toString(),
      season: simulation.season,
      date: simulation.date,
      conferences: simulation.conferences,
      champion: simulation.champion,
      weighting: simulation.weighting,
    };
  }

  // Calculate weighted ratings for teams
  private calculateTeamRatings(teamStats: any[], weighting: WeightingInput): TeamSimulationResult[] {
    return teamStats.map(stat => {
      const weightedRating = (stat.offensiveRating * weighting.offensiveWeight) +
                            ((1 / stat.defensiveRating) * weighting.defensiveWeight) +
                            (stat.threePointPercentage * weighting.threePointWeight);

      return {
        name: stat.teamName,
        weightedRating,
        wins: stat.wins || 0,
        losses: stat.losses || 0,
      };
    });
  }

  // Split teams into conferences
  private splitTeamsByConference(teams: TeamSimulationResult[]): Record<string, TeamSimulationResult[]> {
    const conferenceTeams: Record<string, TeamSimulationResult[]> = {
      'Eastern': [],
      'Western': [],
    };

    // In a real implementation, we would get the conference from the team stats
    // For this example, we'll split teams into conferences based on their name
    teams.forEach(team => {
      if (team.name.includes('Eastern')) {
        conferenceTeams['Eastern'].push(team);
      } else {
        conferenceTeams['Western'].push(team);
      }
    });

    return conferenceTeams;
  }

  // Simulate play-in tournament
  private simulatePlayInTournament(teams: TeamSimulationResult[]): TeamSimulationResult[] {
    // Sort teams by wins (descending)
    const sortedTeams = teams.sort((a, b) => b.wins - a.wins);

    // Get the 7th to 10th seeds
    const seed7 = sortedTeams[6];
    const seed8 = sortedTeams[7];
    const seed9 = sortedTeams[8];
    const seed10 = sortedTeams[9];

    // Game 1: 7th vs 8th (winner gets 7th seed)
    const game1Winner = this.simulateGame(seed7, seed8);

    // Game 2: 9th vs 10th (loser is eliminated)
    const game2Winner = this.simulateGame(seed9, seed10);

    // Game 3: Loser of Game 1 vs Winner of Game 2 (winner gets 8th seed)
    const game3Winner = this.simulateGame(
      game1Winner === seed7 ? seed8 : seed7,
      game2Winner
    );

    // Final seeds after play-in
    return [
      sortedTeams[0], // 1st seed
      sortedTeams[1], // 2nd seed
      sortedTeams[2], // 3rd seed
      sortedTeams[3], // 4th seed
      sortedTeams[4], // 5th seed
      sortedTeams[5], // 6th seed
      game1Winner,    // 7th seed
      game3Winner,    // 8th seed
    ];
  }

  // Simulate a single game
  private simulateGame(team1: TeamSimulationResult, team2: TeamSimulationResult): TeamSimulationResult {
    const team1Chance = team1.weightedRating / (team1.weightedRating + team2.weightedRating);
    const random = Math.random();

    return random < team1Chance ? team1 : team2;
  }

  // Simulate a best-of-7 series
  private simulateSeries(team1: TeamSimulationResult, team2: TeamSimulationResult, useLuckFactor: boolean, useHomeCourtAdvantage: boolean): SeriesResult {
    let team1Wins = 0;
    let team2Wins = 0;

    while (team1Wins < 4 && team2Wins < 4) {
      const winner = this.simulateGame(team1, team2);
      if (winner === team1) {
        team1Wins++;
      } else {
        team2Wins++;
      }
    }

    return {
      team1,
      team2,
      winner: team1Wins > team2Wins ? team1 : team2,
      team1Wins,
      team2Wins,
    };
  }

  // Simulate conference playoffs
  private simulateConferencePlayoffs(
    conferenceName: string,
    teams: TeamSimulationResult[],
    useLuckFactor: boolean,
    useHomeCourtAdvantage: boolean
  ): ConferenceResult {
    const rounds: RoundResult[] = [];
    let remainingTeams = [...teams];

    // Simulate each round (first round, semifinals, conference finals)
    for (let round = 1; round <= 3; round++) {
      const seriesResults: SeriesResult[] = [];
      const nextRoundTeams: TeamSimulationResult[] = [];

      // Pair teams in the current round
      for (let i = 0; i < remainingTeams.length; i += 2) {
        const team1 = remainingTeams[i];
        const team2 = remainingTeams[i + 1];

        const seriesResult = this.simulateSeries(team1, team2, useLuckFactor, useHomeCourtAdvantage);
        seriesResults.push(seriesResult);
        nextRoundTeams.push(seriesResult.winner);
      }

      rounds.push({ round, series: seriesResults });
      remainingTeams = nextRoundTeams;
    }

    // The last remaining team is the conference champion
    const champion = remainingTeams[0];

    return {
      name: conferenceName,
      rounds,
      champion,
    };
  }

  // Simulate NBA Finals
  private simulateFinals(
    easternChampion: TeamSimulationResult,
    westernChampion: TeamSimulationResult,
    useLuckFactor: boolean,
    useHomeCourtAdvantage: boolean
  ): TeamSimulationResult {
    const seriesResult = this.simulateSeries(easternChampion, westernChampion, useLuckFactor, useHomeCourtAdvantage);
    return seriesResult.winner;
  }
}