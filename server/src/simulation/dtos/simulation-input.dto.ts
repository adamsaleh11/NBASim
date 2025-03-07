import { InputType, Field, Float } from '@nestjs/graphql';

@InputType()
export class WeightingInput {
  @Field(() => Float)
  offensiveWeight: number;

  @Field(() => Float)
  defensiveWeight: number;

  @Field(() => Float)
  threePointWeight: number;
}

@InputType()
export class SimulationInput {
  @Field()
  season: string;

  @Field({ nullable: true })
  date?: Date;

  @Field(() => WeightingInput, { nullable: true })
  weighting?: WeightingInput;

  @Field(() => Boolean, { nullable: true, defaultValue: false })
  useLuckFactor?: boolean;

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  useHomeCourtAdvantage?: boolean;
}