import { InputType, Field, Float, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsNumber, IsOptional, IsDate, ValidateNested, IsBoolean, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

@InputType()
export class WeightingInput {
  @Field(() => Float, { defaultValue: 0.30, description: 'Weight for offensive rating (0-1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  offensiveWeight: number = 0.30;

  @Field(() => Float, { defaultValue: 0.50, description: 'Weight for defensive rating (0-1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  defensiveWeight: number = 0.50;

  @Field(() => Float, { defaultValue: 0.20, description: 'Weight for three-point percentage (0-1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  threePointWeight: number = 0.20;
}

@InputType()
export class SimulationInput {
  @Field({ description: 'Season for the simulation (e.g., "2023-2024")' })
  @IsNotEmpty()
  @IsString()
  season: string;

  @Field({ nullable: true, description: 'Date for fetching stats (optional, defaults to current date)' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  date?: Date;

  @Field(() => WeightingInput, { nullable: true, description: 'Custom weighting for simulation metrics (optional)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => WeightingInput)
  weighting?: WeightingInput;

  @Field(() => Boolean, { nullable: true, defaultValue: false, description: 'Enable luck factor in simulations (optional, defaults to false)' })
  @IsOptional()
  @IsBoolean()
  useLuckFactor?: boolean;

  @Field(() => Boolean, { nullable: true, defaultValue: true, description: 'Enable home court advantage in simulations (optional, defaults to true)' })
  @IsOptional()
  @IsBoolean()
  useHomeCourtAdvantage?: boolean;
}