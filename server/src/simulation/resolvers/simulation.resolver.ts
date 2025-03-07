import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common'; // Import exceptions and Logger from @nestjs/common
import { SimulationService } from '../services/simulation.service';
import { EspnDataService } from '../../data-source/services/espn-data.service';
import { SimulationInput, WeightingInput } from '../dtos/simulation-input.dto';
import { SimulationResult } from '../dtos/simulation-result.dto'; // Correct import path for SimulationResult

@Resolver(() => SimulationResult)
export class SimulationResolver {
  private readonly logger = new Logger(SimulationResolver.name); // Logger for resolvers

  constructor(
    private readonly simulationService: SimulationService,
    private readonly espnDataService: EspnDataService,
  ) {}

  @Query(() => [SimulationResult], { description: 'Get a list of simulations, optionally filtered by season' })
  async simulations(
    @Args('season', { nullable: true, description: 'Filter simulations by season (e.g., "2023-2024")' }) season?: string,
    @Args('limit', { nullable: true, defaultValue: 10, description: 'Limit the number of simulations returned (default: 10)' }) limit?: number,
  ): Promise<SimulationResult[]> {
    this.logger.log(`Fetching simulations for season: ${season}, limit: ${limit}`); // Log query start
    try {
      const simulations = await this.simulationService.getSimulations(season, limit);
      this.logger.log(`Successfully fetched ${simulations.length} simulations.`); // Log success
      return simulations;
    } catch (error) {
      this.logger.error(`Error fetching simulations: ${error.message}`, error.stack); // Log error with stack trace
      throw new NotFoundException(`Failed to fetch simulations: ${error.message}`); // Use NotFoundException
    }
  }

  @Query(() => SimulationResult, { nullable: true, description: 'Get a simulation by ID' })
  async simulation(
    @Args('id', { description: 'ID of the simulation to retrieve' }) id: string,
  ): Promise<SimulationResult> {
    this.logger.log(`Fetching simulation with ID: ${id}`); // Log query start
    try {
      const simulation = await this.simulationService.getSimulationById(id);
      this.logger.log(`Successfully fetched simulation with ID: ${id}`); // Log success
      return simulation;
    } catch (error) {
      this.logger.error(`Error fetching simulation by ID ${id}: ${error.message}`, error.stack); // Log error with stack trace
      if (error instanceof NotFoundException) { // Re-throw NotFoundException if it's a 404
        throw error;
      }
      throw new InternalServerErrorException(`Failed to retrieve simulation with ID ${id}.`); // Use InternalServerErrorException for other errors
    }
  }

  @Mutation(() => SimulationResult, { description: 'Run a new simulation' })
  async runSimulation(
    @Args('input', { description: 'Input parameters for the simulation' }) input: SimulationInput,
  ): Promise<SimulationResult> {
    this.logger.log(`Running simulation with input: ${JSON.stringify(input)}`); // Log mutation start
    try {
      const simulationResult = await this.simulationService.runSimulation(input);
      this.logger.log(`Simulation completed successfully, ID: ${simulationResult.id}`); // Log success
      return simulationResult;
    } catch (error) {
      this.logger.error(`Error running simulation: ${error.message}`, error.stack); // Log error with stack trace
      if (error instanceof BadRequestException) { // Re-throw BadRequestException if it's a 400
        throw error;
      }
      throw new InternalServerErrorException(`Failed to run simulation: ${error.message}`); // Use InternalServerErrorException for other errors
    }
  }

  @Query(() => SimulationResult, { description: 'Get the latest simulation' })
  async latestSimulation(): Promise<SimulationResult> {
    this.logger.log(`Fetching latest simulation`); // Log query start
    try {
      const latestSimulationResult = await this.simulationService.getLatestSimulation();
      this.logger.log(`Successfully fetched latest simulation, ID: ${latestSimulationResult.id}`); // Log success
      return latestSimulationResult;
    } catch (error) {
      this.logger.error(`Error fetching latest simulation: ${error.message}`, error.stack); // Log error with stack trace
      if (error instanceof NotFoundException) { // Re-throw NotFoundException if it's a 404
        throw error;
      }
      throw new InternalServerErrorException(`Failed to retrieve latest simulation.`); // Use InternalServerErrorException for other errors
    }
  }

  @Query(() => SimulationResult, {
    nullable: true,
    description: 'Fetch and return (simplified) current playoff simulation data from ESPN (Note: Simplification applied for production readiness - workflow needs clarification)'
  })
  async currentPlayoffSimulation(
    @Args('weighting', { nullable: true, description: 'Optional weighting to pass to ESPN data service (may not be fully utilized in simplified version)' }) weighting?: WeightingInput, // Keep weighting arg for potential future use/ESPN service changes
  ): Promise<SimulationResult> {
    this.logger.log(`Fetching current playoff simulation data from ESPN (simplified version) with weighting: ${JSON.stringify(weighting)}`); // Log query start
    try {
      const playoffResult = await this.espnDataService.simulateCurrentPlayoffs({ // Pass weighting - even if ESPN service ignores it now, for future flexibility
        offensive: weighting?.offensiveWeight ?? 0.30,
        defensive: weighting?.defensiveWeight ?? 0.50,
        threePoint: weighting?.threePointWeight ?? 0.20,
      });

      if (!playoffResult || !playoffResult.champion) { // Basic check for valid ESPN data
        this.logger.warn(`ESPN Data Service did not return valid playoff simulation data.`);
        throw new NotFoundException('Could not retrieve current playoff simulation data from ESPN.'); // Not found if ESPN data is invalid/missing
      }

      const simulationResult: SimulationResult = { // Create a simplified SimulationResult
        id: 'espn-current-playoffs', // Hardcoded ID as it's not a saved simulation in DB (in this simplified version)
        season: this.espnDataService.getCurrentSeason(),
        date: new Date(), // Current date
        conferences: [ // Simplified conference structure - adjust if ESPN data provides more detail in future
          { name: 'Eastern', rounds: [], champion: { name: playoffResult.champion, weightedRating: 0, wins: 0, losses: 0 } },
          { name: 'Western', rounds: [], champion: { name: playoffResult.champion, weightedRating: 0, wins: 0, losses: 0 } },
        ],
        champion: { name: playoffResult.champion, weightedRating: 0, wins: 0, losses: 0 },
        weighting: weighting || { offensiveWeight: 0, defensiveWeight: 0, threePointWeight: 0 }, // Use provided weighting or default to zeroed weights for ESPN data
      };

      this.logger.log(`Successfully fetched and processed current playoff simulation data from ESPN.`); // Log success
      return simulationResult;

    } catch (error) {
      this.logger.error(`Error fetching current playoff simulation from ESPN: ${error.message}`, error.stack); // Log error with stack trace
      if (error instanceof NotFoundException) { // Re-throw NotFoundException if it's a 404 from ESPN data fetch
        throw error;
      }
      throw new InternalServerErrorException(`Failed to simulate current playoffs: ${error.message}`); // Use InternalServerErrorException for other errors
    }
  }
}