import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Simulation, SimulationDocument } from '../schemas/simulation.schema';
import { SimulationInput, WeightingInput } from '../dtos/simulation-input.dto'; // Correct import path to simulation-input.dto.ts
import { SimulationResult, ConferenceResult, RoundResult, SeriesResult, TeamSimulationResult, GameResult } from '../dtos/simulation-result.dto'; // Correct import path to simulation-output.dto.ts
import { StatsService } from '../../stats/services/stats.service';
import { TeamStatsDTO } from '../../stats/dtos/team-stats.dto';

@Injectable()
export class SimulationService {
  private readonly logger = new Logger(SimulationService.name);

  constructor(
    @InjectModel(Simulation.name) private simulationModel: Model<SimulationDocument>,
    private readonly statsService: StatsService,
  ) {}

  // Get all simulations (optionally filtered by season)
  async getSimulations(season?: string, limit = 10): Promise<SimulationResult[]> {
    try {
      const query = season ? { season } : {};
      const simulations = await this.simulationModel.find(query).sort({ date: -1 }).limit(limit).exec();
      return simulations.map(sim => this.mapToSimulationResult(sim));
    } catch (error) {
      this.logger.error(`Error fetching simulations: ${error.message}`, error.stack);
      throw new Error('Failed to retrieve simulations.'); // More user-friendly error
    }
  }

  // Get a simulation by ID
  async getSimulationById(id: string): Promise<SimulationResult> {
    try {
      const simulation = await this.simulationModel.findById(id).exec();
      if (!simulation) {
        throw new NotFoundException(`Simulation with ID ${id} not found`); // Use NestJS NotFoundException
      }
      return this.mapToSimulationResult(simulation);
    } catch (error) {
      this.logger.error(`Error fetching simulation by ID ${id}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) { // Re-throw NotFoundException
        throw error;
      }
      throw new Error(`Failed to retrieve simulation with ID ${id}.`); // More user-friendly error
    }
  }

  // Get the latest simulation
  async getLatestSimulation(): Promise<SimulationResult> {
    try {
      const simulation = await this.simulationModel.findOne().sort({ date: -1 }).exec();
      if (!simulation) {
        throw new NotFoundException('No simulations found'); // Use NestJS NotFoundException
      }
      return this.mapToSimulationResult(simulation);
    } catch (error) {
      this.logger.error(`Error fetching latest simulation: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) { // Re-throw NotFoundException
        throw error;
      }
      throw new Error('Failed to retrieve latest simulation.'); // More user-friendly error
    }
  }

  // Run a new simulation
  async runSimulation(input: SimulationInput): Promise<SimulationResult> {
    this.logger.log(`Running simulation for season ${input.season} with weighting: ${JSON.stringify(input.weighting)}`);

    const date = input.date || new Date();
    const weighting = input.weighting || {
      offensiveWeight: 0.30,
      defensiveWeight: 0.50,
      threePointWeight: 0.20,
    };

    try {
      // Fetch the latest stats for each team
      const teamStats = await this.statsService.getTeamStats({
        season: input.season,
        date,
      });

      if (!teamStats || teamStats.length < 16) {
        this.logger.warn(`Insufficient team stats fetched for season ${input.season} and date ${date}. Found ${teamStats ? teamStats.length : 0} teams.`);
        throw new BadRequestException('Insufficient team data to run simulation. Please ensure data is available for at least 16 teams.'); // Use NestJS BadRequestException
      }

      // Calculate weighted ratings for each team
      const teamsWithRatings = this.calculateTeamRatings(teamStats, weighting);

      // Split teams into conferences
      const conferences = this.splitTeamsByConference(teamsWithRatings, teamStats);

      // Simulate play-in tournament for both conferences
      const easternPlayoffTeams = this.simulatePlayInTournament(conferences['Eastern']);
      const westernPlayoffTeams = this.simulatePlayInTournament(conferences['Western']);

      // Simulate playoffs for each conference
      const easternResult = this.simulateConferencePlayoffs('Eastern', easternPlayoffTeams, input.useLuckFactor || false, input.useHomeCourtAdvantage || true);
      const westernResult = this.simulateConferencePlayoffs('Western', westernPlayoffTeams, input.useLuckFactor || false, input.useHomeCourtAdvantage || true);

      // Simulate NBA Finals
      const nbaChampion = this.simulateFinals(
        easternResult.champion,
        westernResult.champion,
        input.useLuckFactor || false,
        input.useHomeCourtAdvantage || true
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
      return this.mapToSimulationResult(savedSimulation);

    } catch (error) {
      this.logger.error(`Error running simulation for season ${input.season}: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) { // Re-throw BadRequestException
        throw error;
      }
      throw new Error(`Failed to run simulation for season ${input.season}.`); // More user-friendly error
    }
  }

  async runSimulationForCurrentYear(): Promise<SimulationResult> {
    this.logger.log('Starting simulation for current year...');
    const currentSeason = this.statsService.getCurrentSeason(); // Use StatsService to get current season
    this.logger.log(`Current season determined as: ${currentSeason}`);

    const simulationInput: SimulationInput = { // Create SimulationInput for current year
      season: currentSeason,
      date: new Date(), // Use current date for simulation
      useLuckFactor: true, // Or your desired default
      useHomeCourtAdvantage: true, // Or your desired default
      weighting: {       // Or your desired default weighting
        offensiveWeight: 0.30,
        defensiveWeight: 0.50,
        threePointWeight: 0.20,
      },
    };

    try {
      const simulationResult = await this.runSimulation(simulationInput); // Call your existing simulation logic
      this.logger.log('Simulation for current year completed.');
      return simulationResult;
    } catch (error) {
      this.logger.error('Error during simulation for current year:', error);
      throw error; // Re-throw the error to be caught in main.ts
    }
  }


  // Map a MongoDB document to a SimulationResult DTO
  private mapToSimulationResult(simulation: SimulationDocument): SimulationResult {
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
  private calculateTeamRatings(teamStats: TeamStatsDTO[], weighting: WeightingInput): TeamSimulationResult[] {
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
  private splitTeamsByConference(teams: TeamSimulationResult[], teamStats: TeamStatsDTO[]): Record<string, TeamSimulationResult[]> {
    const conferenceTeams: Record<string, TeamSimulationResult[]> = {
      'Eastern': [],
      'Western': [],
    };

    teamStats.forEach((stat, index) => { // Iterate over teamStats to get conference info
      const team = teams[index];
      const conference = stat.conference || 'Western'; // Fallback to Western if conference is missing
      if (!stat.conference) {
        this.logger.warn(`Conference missing for team ${stat.teamName}. Defaulting to Western Conference.`); // Log missing conference
      }
      conferenceTeams[conference].push(team);
    });

    return conferenceTeams;
  }

  // Simulate play-in tournament
  private simulatePlayInTournament(teams: TeamSimulationResult[]): TeamSimulationResult[] {
    if (teams.length < 10) {
      throw new Error(`Not enough teams in conference for play-in tournament (found ${teams.length}, need at least 10)`);
    }

    // Sort teams by wins (descending) with default value for undefined wins
    const sortedTeams = teams.sort((a, b) => (b.wins ?? 0) - (a.wins ?? 0));

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
    const game3LoserGame1 = (game1Winner === seed7 ? seed8 : seed7);
    const game3Winner = this.simulateGame( game3LoserGame1, game2Winner);

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
    if (!team1 || !team2) {
      this.logger.error(`simulateGame called with undefined team: Team 1: ${team1}, Team 2: ${team2}`);
      throw new Error('Invalid input to simulateGame: team data missing.');
    }
    const team1Chance = team1.weightedRating / (team1.weightedRating + team2.weightedRating);
    const random = Math.random();

    return random < team1Chance ? team1 : team2;
  }

  // Simulate a best-of-7 series
  private simulateSeries(team1: TeamSimulationResult, team2: TeamSimulationResult, useLuckFactor: boolean, useHomeCourtAdvantage: boolean): SeriesResult {
    if (!team1 || !team2) {
      this.logger.error(`simulateSeries called with undefined team: Team 1: ${team1}, Team 2: ${team2}`);
      throw new Error('Invalid input to simulateSeries: team data missing.');
    }

    let team1Wins = 0;
    let team2Wins = 0;
    const games: GameResult[] = [];

    while (team1Wins < 4 && team2Wins < 4) {
      const gameNumber = team1Wins + team2Wins + 1;
      const team1HasHomeCourt = useHomeCourtAdvantage && [1, 2, 5, 7].includes(gameNumber);
      const luckFactor = useLuckFactor ? (Math.random() * 0.04) - 0.02 : 0;
      const homeCourtAdvantage = team1HasHomeCourt ? 0.03 : 0;

      const team1EffectiveRating = team1.weightedRating + luckFactor + homeCourtAdvantage;
      const team2EffectiveRating = team2.weightedRating + luckFactor + (team1HasHomeCourt ? 0 : 0.03);

      const team1Chance = team1EffectiveRating / (team1EffectiveRating + team2EffectiveRating);
      const random = Math.random();
      const winner = random < team1Chance ? team1 : team2;

      if (winner === team1) {
        team1Wins++;
      } else {
        team2Wins++;
      }

      games.push({
        gameNumber,
        winner: winner.name,
        homeTeam: team1HasHomeCourt,
      });
      this.logger.log(`Game ${gameNumber}: ${winner.name} wins ${team1HasHomeCourt ? '(home)' : '(away)'}`);
    }

    return {
      team1,
      team2,
      winner: team1Wins > team2Wins ? team1 : team2,
      team1Wins,
      team2Wins,
      games,
    };
  }

  // Simulate conference playoffs
  private simulateConferencePlayoffs(
    conferenceName: string,
    teams: TeamSimulationResult[],
    useLuckFactor: boolean,
    useHomeCourtAdvantage: boolean
  ): ConferenceResult {
    if (!teams || teams.length < 8 ) {
      this.logger.error(`simulateConferencePlayoffs called with insufficient teams for conference ${conferenceName}: ${teams?.length}`);
      throw new Error(`Insufficient teams to simulate ${conferenceName} conference playoffs.`);
    }

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
        if (!team1 || !team2) { // Defensive check for team data
          this.logger.error(`simulateConferencePlayoffs pairing error in round ${round} of ${conferenceName}: Team 1: ${team1}, Team 2: ${team2}`);
          throw new Error(`Error pairing teams for round ${round} of ${conferenceName} conference playoffs.`);
        }

        const seriesResult = this.simulateSeries(team1, team2, useLuckFactor, useHomeCourtAdvantage);
        seriesResults.push(seriesResult);
        nextRoundTeams.push(seriesResult.winner);
      }

      rounds.push({ round, series: seriesResults });
      remainingTeams = nextRoundTeams;
    }

    // The last remaining team is the conference champion
    const champion = remainingTeams[0];
    if (!champion) {
      this.logger.error(`No champion determined for ${conferenceName} conference playoffs.`);
      throw new Error(`Could not determine conference champion for ${conferenceName}. Simulation error.`);
    }

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
    if (!easternChampion || !westernChampion) {
      this.logger.error(`simulateFinals called with undefined champion: Eastern Champion: ${easternChampion}, Western Champion: ${westernChampion}`);
      throw new Error('Invalid input to simulateFinals: conference champion data missing.');
    }
    const seriesResult = this.simulateSeries(easternChampion, westernChampion, useLuckFactor, useHomeCourtAdvantage);
    return seriesResult.winner;
  }
}