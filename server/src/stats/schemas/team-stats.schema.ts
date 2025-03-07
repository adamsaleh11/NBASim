import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Team } from '../../teams/schemas/team.schema';

export type TeamStatsDocument = TeamStats & Document;

@Schema({ timestamps: true, collection: 'teamstats' }) // Added collection name for clarity
export class TeamStats {
  @Prop({ required: true, type: Date, index: true }) // Index for date-based queries
  date: Date;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Team', index: true }) // Index and ref
  teamId: Team;

  @Prop({ required: true, index: true }) // Index for season-based queries
  season: string;

  @Prop({ required: true, type: Number }) // Explicit type: Number
  offensiveRating: number;

  @Prop({ required: true, type: Number }) // Explicit type: Number
  defensiveRating: number;

  @Prop({ required: true, type: Number, min: 0, max: 1 }) // Percentage, ensure 0-1 range
  threePointPercentage: number;

  @Prop({ type: Number, default: null, min: 0, max: 1 }) // Percentage, ensure 0-1 range
  fieldGoalPercentage: number;

  @Prop({ type: Number, default: null, min: 0 }) // Non-negative values
  reboundsPerGame: number;

  @Prop({ type: Number, default: null, min: 0 }) // Non-negative values
  assistsPerGame: number;

  @Prop({ type: Number, default: null, min: 0 }) // Non-negative values
  turnoversPerGame: number;

  @Prop({ type: Number, default: null, min: 0 }) // Non-negative values
  stealsPerGame: number;

  @Prop({ type: Number, default: null, min: 0 }) // Non-negative values
  blocksPerGame: number;

  @Prop({ type: Number, default: null, min: 0 }) // Non-negative values
  pointsPerGame: number;

  @Prop({ type: Number, default: null, min: 0 }) // Non-negative values
  gamesPlayed: number;

  @Prop({ type: Number, default: null, min: 0 }) // Non-negative values
  wins: number;

  @Prop({ type: Number, default: null, min: 0 }) // Non-negative values
  losses: number;

  @Prop({ type: Object, default: {} }) // Flexible for future stats
  additionalStats: Record<string, number>;

  @Prop({ default: 'ESPN', maxlength: 50 }) // Limit dataSource string length
  dataSource: string;
}

export const TeamStatsSchema = SchemaFactory.createForClass(TeamStats);

// Indexes for efficient queries (already in your original code, re-iterating for emphasis)
TeamStatsSchema.index({ date: 1, teamId: 1 }); // Compound index for time-series queries
TeamStatsSchema.index({ season: 1 }); // Index for season-based filtering