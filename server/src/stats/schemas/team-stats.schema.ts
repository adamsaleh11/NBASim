// src/stats/schemas/team-stats.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Team } from '../../teams/schemas/team.schema';

export type TeamStatsDocument = TeamStats & Document;

@Schema({ timestamps: true })
export class TeamStats {
  @Prop({ required: true, type: Date })
  date: Date;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Team' })
  teamId: Team;

  @Prop({ required: true })
  season: string;

  @Prop({ required: true })
  offensiveRating: number;

  @Prop({ required: true })
  defensiveRating: number;

  @Prop({ required: true })
  threePointPercentage: number;

  @Prop()
  fieldGoalPercentage: number;

  @Prop()
  reboundsPerGame: number;

  @Prop()
  assistsPerGame: number;

  @Prop()
  turnoversPerGame: number;

  @Prop()
  stealsPerGame: number;

  @Prop()
  blocksPerGame: number;

  @Prop()
  pointsPerGame: number;

  @Prop()
  gamesPlayed: number;

  @Prop()
  wins: number;

  @Prop()
  losses: number;

  @Prop({ type: Object })
  additionalStats: Record<string, number>;

  @Prop()
  dataSource: string;
}

export const TeamStatsSchema = SchemaFactory.createForClass(TeamStats);