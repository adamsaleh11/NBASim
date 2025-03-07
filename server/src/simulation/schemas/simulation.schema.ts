import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
import { ConferenceResult, TeamSimulationResult, WeightingInput } from '../dtos/simulation-result.dto'; // Assuming DTOs are used

export type SimulationDocument = Simulation & Document;

@Schema({ collection: 'simulations', timestamps: true }) // Added collection name
export class Simulation {
  @Prop({ type: mongoose.Schema.Types.ObjectId, auto: true }) // Explicit ObjectId, auto-generated
  _id: mongoose.Types.ObjectId; // Explicitly type _id as ObjectId

  @Prop({ required: true, maxlength: 20 }) // Limit season string length
  season: string;

  @Prop({ required: true, type: Date, index: true }) // Index for date-based queries
  date: Date;

  @Prop({ type: [{ // Array of ConferenceResult objects
    name: { type: String, required: true, maxlength: 50 }, // Limit conference name length
    rounds: { type: [], default: [] }, // Keep rounds as array, consider specific type if rounds data is structured
    champion: { type: Object, required: true }, // Expecting TeamSimulationResult object here
  }], default: [] })
  conferences: ConferenceResult[]; // Type as ConferenceResult[] for clarity

  @Prop({ type: Object, required: true }) // Expecting TeamSimulationResult object here
  champion: TeamSimulationResult; // Type as TeamSimulationResult for clarity

  @Prop({ type: Object, default: {} }) // Weighting input object
  weighting: WeightingInput; // Type as WeightingInput for clarity
}

export const SimulationSchema = SchemaFactory.createForClass(Simulation);
SimulationSchema.index({ date: -1 }); // Index for fetching latest simulations (descending date)