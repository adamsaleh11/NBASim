import { ObjectType, Field, InputType } from '@nestjs/graphql'; // InputType import is not needed here, removing
import { WeightingInput } from './simulation-input.dto'; // Correct relative path to WeightingInput - important!

@ObjectType()
export class GameResult {
  @Field()
  gameNumber: number;

  @Field()
  winner: string;

  @Field({ nullable: true })
  homeTeam?: boolean;
}

@ObjectType()
export class TeamSimulationResult {
  @Field()
  name: string;

  @Field()
  weightedRating: number;

  @Field({ nullable: true })
  wins?: number;

  @Field({ nullable: true })
  losses?: number;
}

@ObjectType()
export class SeriesResult {
  @Field(() => TeamSimulationResult)
  team1: TeamSimulationResult;

  @Field(() => TeamSimulationResult)
  team2: TeamSimulationResult;

  @Field(() => TeamSimulationResult)
  winner: TeamSimulationResult;

  @Field()
  team1Wins: number;

  @Field()
  team2Wins: number;

  @Field(() => [GameResult])
  games: GameResult[];
}

@ObjectType()
export class RoundResult {
  @Field()
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

  @Field(() => TeamSimulationResult, { nullable: true })
  champion?: TeamSimulationResult;

  @Field(() => WeightingInput) // Correct relative import path to WeightingInput!
  weighting: WeightingInput;
}

export { WeightingInput };
