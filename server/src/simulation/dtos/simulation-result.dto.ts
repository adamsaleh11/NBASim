// src/simulation/dtos/simulation-result.dto.ts

import { ObjectType, Field, Float, Int } from '@nestjs/graphql';
import { WeightingInput } from './simulation-input.dto';

@ObjectType()
export class TeamSimulationResult {
  @Field()
  name: string;

  @Field(() => Float)
  weightedRating: number;

  @Field(() => Int)
  wins: number;

  @Field(() => Int)
  losses: number;
}

@ObjectType()
export class SeriesResult {
  @Field(() => TeamSimulationResult)
  team1: TeamSimulationResult;

  @Field(() => TeamSimulationResult)
  team2: TeamSimulationResult;

  @Field(() => TeamSimulationResult)
  winner: TeamSimulationResult;

  @Field(() => Int)
  team1Wins: number;

  @Field(() => Int)
  team2Wins: number;
}

@ObjectType()
export class RoundResult {
  @Field(() => Int)
  round: number;

  @Field(() => [SeriesResult])
  series: SeriesResult[];
}

@ObjectType()
export class ConferenceResult {
  @Field()
  name: string;

  @Field(() => [RoundResult])
  rounds: RoundResult[];

  @Field(() => TeamSimulationResult)
  champion: TeamSimulationResult;
}

@ObjectType()
export class SimulationResult {
  @Field()
  id: string;

  @Field()
  season: string;

  @Field()
  date: Date;

  @Field(() => [ConferenceResult])
  conferences: ConferenceResult[];

  @Field(() => TeamSimulationResult)
  champion: TeamSimulationResult;

  @Field(() => WeightingInput)
  weighting: WeightingInput;
}