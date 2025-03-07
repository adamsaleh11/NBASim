// src/stats/dtos/team-stats.dto.ts

import { ObjectType, Field, Float, Int, ID } from '@nestjs/graphql';

@ObjectType()
export class TeamStatsDTO {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  teamId: string;

  @Field()
  teamName: string;

  @Field()
  conference: string;

  @Field()
  season: string;

  @Field(() => Date)
  date: Date;

  @Field(() => Float)
  offensiveRating: number;

  @Field(() => Float)
  defensiveRating: number;

  @Field(() => Float)
  threePointPercentage: number;

  @Field(() => Float, { nullable: true })
  fieldGoalPercentage?: number;

  @Field(() => Float, { nullable: true })
  reboundsPerGame?: number;

  @Field(() => Float, { nullable: true })
  assistsPerGame?: number;

  @Field(() => Float, { nullable: true })
  turnoversPerGame?: number;

  @Field(() => Float, { nullable: true })
  stealsPerGame?: number;

  @Field(() => Float, { nullable: true })
  blocksPerGame?: number;

  @Field(() => Float, { nullable: true })
  pointsPerGame?: number;

  @Field(() => Int, { nullable: true })
  gamesPlayed?: number;

  @Field(() => Int, { nullable: true })
  wins?: number;

  @Field(() => Int, { nullable: true })
  losses?: number;

  @Field(() => Object, { nullable: true })
  additionalStats?: Record<string, number>;

  @Field({ nullable: true })
  dataSource?: string;
}