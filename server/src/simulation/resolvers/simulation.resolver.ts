// src/simulation/resolvers/simulation.resolver.ts

import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { SimulationService } from '../services/simulation.service';
import { SimulationInput } from '../dtos/simulation-input.dto';
import { SimulationResult } from '../dtos/simulation-result.dto';

@Resolver(() => SimulationResult)
export class SimulationResolver {
  constructor(private readonly simulationService: SimulationService) {}

  // Get all simulations (optionally filtered by season)
  @Query(() => [SimulationResult])
  async simulations(
    @Args('season', { nullable: true }) season?: string,
    @Args('limit', { nullable: true, defaultValue: 10 }) limit?: number,
  ): Promise<SimulationResult[]> {
    return this.simulationService.getSimulations(season, limit);
  }

  // Get a simulation by ID
  @Query(() => SimulationResult, { nullable: true })
  async simulation(
    @Args('id') id: string,
  ): Promise<SimulationResult> {
    return this.simulationService.getSimulationById(id);
  }

  // Run a new simulation
  @Mutation(() => SimulationResult)
  async runSimulation(
    @Args('input') input: SimulationInput,
  ): Promise<SimulationResult> {
    return this.simulationService.runSimulation(input);
  }

  // Get the latest simulation
  @Query(() => SimulationResult)
  async latestSimulation(): Promise<SimulationResult> {
    return this.simulationService.getLatestSimulation();
  }
}