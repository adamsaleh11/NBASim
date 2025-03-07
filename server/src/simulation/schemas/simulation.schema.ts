import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ConferenceResult } from '../../simulation/dtos/simulation-result.dto';
import { TeamSimulationResult } from '../../simulation/dtos/simulation-result.dto';
import { WeightingInput } from '../../simulation/dtos/simulation-input.dto';

export type SimulationDocument = Simulation & Document;

@Schema({ timestamps: true })
export class Simulation {
  @Prop({ required: true })
  season: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ type: Object })
  conferences: ConferenceResult[];

  @Prop({ type: Object })
  champion: TeamSimulationResult;

  @Prop({ type: Object })
  weighting: WeightingInput;
}

export const SimulationSchema = SchemaFactory.createForClass(Simulation);